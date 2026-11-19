"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import {
  consumeRateLimit,
  hashRateLimitKey,
  rateLimitRules,
} from "@/lib/rate-limit";
import { requireApprovedMember } from "@/features/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/features/auth/action-state";
import { postSchema, formDataToObject } from "./validation";
import { validatePhotoBytes } from "@/features/media/image";
import { isValidMediaKey, POST_MEDIA_BUCKET } from "@/features/media/limits";

/**
 * Publishing a post. Server action on purpose: it is the one place that can
 * rate-limit (`feed:post` in Postgres) before the insert, while the row itself
 * is still checked by RLS and the `posts` constraints.
 *
 * Supports pure text posts, photo posts with optional captions, or both.
 * For photo posts, the server validates the actual image bytes stored in
 * Supabase Storage before persisting metadata in Postgres via `create_post` RPC.
 */
export async function createPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireApprovedMember();
  const parsed = postSchema.safeParse(formDataToObject(formData));

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
    rateLimitRules.postCreate,
    hashRateLimitKey(`user:${viewer.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const { body, mediaKey, altText } = parsed.data;

  // Text-only post
  if (!mediaKey) {
    const { error } = await supabase.rpc("create_post", {
      p_body: body,
    });

    if (error) {
      console.error("[feed] text post creation failed", error.message);
      return { status: "error", code: "post_failed" };
    }
  } else {
    // Photo post: ensure media key format matches owner folder
    if (!isValidMediaKey(mediaKey, viewer.id)) {
      console.error("[feed] invalid media key format/ownership", mediaKey);
      return { status: "error", code: "photo_wrong_type" };
    }

    // Inspect the stored full-resolution bytes to confirm validity + dimensions.
    // Thumbnails are not stored by this path in the current schema — only the
    // full-resolution object is written into `posts` / `post_media` by
    // `create_post` (see supabase/migrations/20260926100000_post_media_photo_posts.sql).
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(POST_MEDIA_BUCKET)
      .download(mediaKey);

    if (downloadError || !fileData) {
      console.error("[feed] failed to download uploaded media", downloadError?.message);
      return { status: "error", code: "photo_unreadable" };
    }

    const fullBytes = new Uint8Array(await fileData.arrayBuffer());
    const fullValidation = validatePhotoBytes(fullBytes, fullBytes.length);

    if (!fullValidation.ok) {
      console.warn("[feed] photo validation failed on server", fullValidation.code);
      await supabase.storage.from(POST_MEDIA_BUCKET).remove([mediaKey]);
      return { status: "error", code: fullValidation.code };
    }

    const { error: rpcError } = await supabase.rpc("create_post", {
      p_body: body,
      p_media_key: mediaKey,
      p_media_mime: fullValidation.image.mime,
      p_media_size: fullBytes.length,
      p_media_width: fullValidation.image.width,
      p_media_height: fullValidation.image.height,
      p_media_alt: altText || undefined,
    });

    if (rpcError) {
      console.error("[feed] photo post creation failed", rpcError.message);
      await supabase.storage.from(POST_MEDIA_BUCKET).remove([mediaKey]);
      return { status: "error", code: "post_failed" };
    }
  }

  const locale = await getLocale();

  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/profile`);

  return { status: "success", code: "post_published" };
}
