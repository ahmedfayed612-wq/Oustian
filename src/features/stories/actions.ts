"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import type { ActionState } from "@/features/auth/action-state";
import { requireApprovedMember } from "@/features/auth/session";
import { validatePhotoBytes } from "@/features/media/image";
import {
  STORY_MEDIA_BUCKET,
  storyMediaKindForKey,
} from "@/features/media/limits";
import { validateVideoBytes } from "@/features/media/video";
import {
  consumeRateLimit,
  hashRateLimitKey,
  rateLimitRules,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import { signedStoryMediaUrls, signedStorageUrls } from "@/lib/supabase/storage";
import {
  listAuthorStories,
  listStoryViewers,
  type StoryItem,
  type StoryViewerRow,
} from "./queries";
import { probeDimensions, storySchema, uuidPattern } from "./validation";

/**
 * Story writes and on-demand reads.
 *
 * Two things are never taken from the client: who owns the upload (the ticket
 * action builds the key from the session, and `create_story` re-checks the
 * folder) and what the bytes actually are (the stored object is downloaded and
 * sniffed here before any row exists — a photo by its signature, a clip by its
 * container). Everything else — visibility, view dedupe, deletion rights —
 * lives in Postgres, so a crafted request cannot reach past it.
 */

export type StoryRingPayload = {
  author: {
    id: string;
    username: string;
    fullName: string;
    avatarUrl: string | null;
  };
  items: (StoryItem & { url: string })[];
};

export type StoryRingResult =
  | { status: "success"; ring: StoryRingPayload }
  | { status: "error"; code: "invalid_story" | "failed" };

export type StoryActionResult =
  | { status: "success"; viewerCount?: number }
  | { status: "error"; code: "invalid_story" | "not_authorised" | "failed" };

/**
 * Publish one story. Server action on purpose: it is the single place that can
 * rate-limit (`stories:create`) before the insert, validate the uploaded bytes
 * and then call the atomic `create_story()` RPC.
 */
export async function createStoryAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireApprovedMember();

  const parsed = storySchema.safeParse({
    mediaKey: formData.get("mediaKey"),
    caption: formData.get("caption"),
    mediaWidth: formData.get("mediaWidth") ?? undefined,
    mediaHeight: formData.get("mediaHeight") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      fields: parsed.error.issues
        .map((issue) => String(issue.path[0] ?? ""))
        .filter(Boolean),
    };
  }

  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.storyCreate,
    hashRateLimitKey(`user:${viewer.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const { mediaKey, caption } = parsed.data;

  // The key must sit in the caller's own folder — a forged path can never
  // attach someone else's object, and the RPC checks this again. The key's
  // extension also decides *how* the bytes are read back, and the ticket
  // action built it from the claimed MIME, so a mislabelled file fails the
  // matching sniffer below instead of reaching the database.
  const kind = storyMediaKindForKey(mediaKey, viewer.id);

  if (!kind) {
    console.error("[stories] invalid media key format/ownership", mediaKey);
    return { status: "error", code: "photo_wrong_type" };
  }

  // Read the stored object back and trust only its bytes.
  const { data: fileData, error: downloadError } = await supabase.storage
    .from(STORY_MEDIA_BUCKET)
    .download(mediaKey);

  if (downloadError || !fileData) {
    console.error(
      "[stories] failed to download uploaded media",
      downloadError?.message,
    );
    return { status: "error", code: "photo_unreadable" };
  }

  const bytes = new Uint8Array(await fileData.arrayBuffer());

  const validation =
    kind === "video"
      ? validateVideoBytes(bytes, bytes.length, probeDimensions(parsed.data))
      : validatePhotoBytes(bytes, bytes.length);

  if (!validation.ok) {
    console.warn(
      `[stories] ${kind} validation failed on server`,
      validation.code,
    );
    // Never keep bytes that failed the policy.
    await supabase.storage.from(STORY_MEDIA_BUCKET).remove([mediaKey]);
    return { status: "error", code: validation.code };
  }

  // The success shapes are distinguishable: a video carries the sniffed
  // container, an image carries the sniffed format and both dimensions.
  const media =
    "video" in validation
      ? {
          mime: validation.video.mime,
          width: validation.width,
          height: validation.height,
        }
      : {
          mime: validation.image.mime,
          width: validation.image.width,
          height: validation.image.height,
        };

  const { error: rpcError } = await supabase.rpc("create_story", {
    p_media_key: mediaKey,
    p_media_mime: media.mime,
    p_media_size: bytes.length,
    p_media_width: media.width,
    p_media_height: media.height,
    p_caption: caption || undefined,
  });

  if (rpcError) {
    console.error("[stories] create_story failed", rpcError.message);
    await supabase.storage.from(STORY_MEDIA_BUCKET).remove([mediaKey]);
    return { status: "error", code: "story_failed" };
  }

  const locale = await getLocale();

  revalidatePath(`/${locale}`);

  return { status: "success", code: "story_published" };
}

/**
 * Opens one author's ring: their live stories in playback order, each with a
 * signed URL. Signing happens with the caller's own client, so the storage
 * policy decides what can be signed — a member outside the audience gets an
 * empty ring rather than someone else's photo.
 *
 * Called on demand (when a tile is tapped) instead of pre-signing every ring
 * on render: the tray only needs avatars, and this keeps the feed render cheap.
 */
export async function loadStoryRingAction(
  authorId: string,
): Promise<StoryRingResult> {
  const viewer = await requireApprovedMember();

  if (!uuidPattern.test(authorId)) {
    return { status: "error", code: "invalid_story" };
  }

  const supabase = await createClient();

  const [items, authorResult] = await Promise.all([
    listAuthorStories(supabase, authorId, viewer.id),
    supabase
      .from("profiles")
      .select("id, username, full_name, avatar_path")
      .eq("id", authorId)
      .maybeSingle(),
  ]);

  const author = authorResult.data;

  if (!author || items.length === 0) {
    return { status: "error", code: "invalid_story" };
  }

  const [mediaUrls, avatarUrls] = await Promise.all([
    signedStoryMediaUrls(
      supabase,
      items.map((item) => item.mediaKey),
    ),
    signedStorageUrls(supabase, [author.avatar_path]),
  ]);

  const withUrls = items
    .map((item) => ({ ...item, url: mediaUrls[item.mediaKey] ?? "" }))
    // A story whose photo cannot be signed is unrenderable: drop it rather
    // than show a broken frame in the middle of playback.
    .filter((item) => item.url.length > 0);

  if (withUrls.length === 0) {
    return { status: "error", code: "invalid_story" };
  }

  return {
    status: "success",
    ring: {
      author: {
        id: author.id,
        username: author.username,
        fullName: author.full_name,
        avatarUrl: author.avatar_path
          ? (avatarUrls[author.avatar_path] ?? null)
          : null,
      },
      items: withUrls,
    },
  };
}

/**
 * Records that the viewer actually watched this story — called when a story is
 * displayed in the viewer, never when the tray merely renders. Postgres
 * deduplicates by (story, viewer) and skips the author's own view, so this can
 * be called on every frame without ever inflating the count.
 */
export async function recordStoryViewAction(
  storyId: string,
): Promise<StoryActionResult> {
  const viewer = await requireApprovedMember();

  if (!uuidPattern.test(storyId)) {
    return { status: "error", code: "invalid_story" };
  }

  const supabase = await createClient();

  // A generous ceiling: one call per story watched, not per scroll.
  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.storyView,
    hashRateLimitKey(`user:${viewer.id}`),
  );

  if (!withinLimit) return { status: "error", code: "failed" };

  const { data, error } = await supabase.rpc("view_story", {
    p_story: storyId,
  });

  if (error) {
    // Expired mid-playback, or no longer visible: the viewer closes quietly.
    console.warn("[stories] view_story failed", error.message);
    return { status: "error", code: "invalid_story" };
  }

  return { status: "success", viewerCount: Number(data ?? 0) };
}

/** Deletes the caller's own story; Postgres enforces whose it is. */
export async function deleteStoryAction(
  storyId: string,
): Promise<StoryActionResult> {
  await requireApprovedMember();

  if (!uuidPattern.test(storyId)) {
    return { status: "error", code: "invalid_story" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_story", { p_story: storyId });

  if (error) {
    const text = error.message.toLowerCase();

    if (text.includes("invalid_story")) {
      return { status: "error", code: "invalid_story" };
    }
    if (text.includes("not_authorised")) {
      return { status: "error", code: "not_authorised" };
    }

    console.error("[stories] delete_story failed", error.message);
    return { status: "error", code: "failed" };
  }

  const locale = await getLocale();

  revalidatePath(`/${locale}`);

  return { status: "success" };
}

/**
 * The audience of one story, for its author. RLS returns rows only to the
 * author, so no extra check is needed here — a non-author simply gets [].
 */
export async function listStoryViewersAction(storyId: string): Promise<
  | { status: "success"; viewers: (StoryViewerRow & { avatarUrl: string | null })[] }
  | { status: "error"; code: "invalid_story" | "failed" }
> {
  await requireApprovedMember();

  if (!uuidPattern.test(storyId)) {
    return { status: "error", code: "invalid_story" };
  }

  const supabase = await createClient();
  const viewers = await listStoryViewers(supabase, storyId);

  const avatarUrls = await signedStorageUrls(
    supabase,
    viewers.map((person) => person.avatarPath),
  );

  return {
    status: "success",
    viewers: viewers.map((person) => ({
      ...person,
      avatarUrl: person.avatarPath
        ? (avatarUrls[person.avatarPath] ?? null)
        : null,
    })),
  };
}

