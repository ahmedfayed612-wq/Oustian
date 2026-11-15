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
import { postSchema } from "./validation";
import {
  createMediaUploadTicketAction,
  MAX_IMAGE_BYTES,
  MAX_MEDIA_PER_POST,
  POST_MEDIA_BUCKET,
} from "./limits";
import { validatePhotoBytes } from "./image";


/**
 * Publishing a post. Server action on purpose: the single canonical publish
 * path, so there is one place that can rate-limit (`feed:post`) before an
 * insert, and the row is still checked by RLS and `create_post` constraints.
 *
 * Supports text-only, image-only, text+image, and multi-image posts
 * (up to MAX_MEDIA_PER_POST). Every image is processed to a full-resolution
 * WebP in the browser, uploaded directly to Storage, then validated on
 * publish with the real stored bytes.
 */
export async function createPostAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const viewer = await requireApprovedMember();

  // 1. Parse + validate ------------------------------------------------------
  const body = formData.get("body")?.toString().trim() ?? "";
  const altText = formData.get("altText")?.toString().trim() ?? "";
  const mediaKeys = formData
    .getAll("mediaKey")
    .map((v) => v.toString().trim())
    .filter(Boolean);

  const parsed = postSchema.safeParse({ body, mediaKeys, altText });
  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      fields: parsed.error.issues.map((i) => String(i.path[0] ?? "")).filter(Boolean),
    };
  }
  const { body: safeBody, mediaKeys: safeKeys, altText: safeAlt } = parsed.data;

  // 2. Rate-limit -------------------------------------------------------------
  const supabase = await createClient();
  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.postCreate,
    hashRateLimitKey(`user:${viewer.id}`),
  );
  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  // 3. Validate ownership of every upload key ---------------------------------
  for (const key of safeKeys) {
    if (!isValidMediaKey(key, viewer.id)) {
      return { status: "error", code: "photo_wrong_type" };
    }
  }

  // 4. Validate the bytes actually stored (authoritative) ---------------------
  const mediaSpecs = await Promise.all(
    safeKeys.map(async (key) => {
      const { data: fileData, error: downloadError } =
        await supabase.storage.from(POST_MEDIA_BUCKET).download(key);
      if (downloadError || !fileData) {
        console.error("[post] failed to download stored media", key, downloadError?.message);
        return null;
      }
      const bytes = new Uint8Array(await fileData.arrayBuffer());
      const info = validatePhotoBytes(bytes, bytes.length);
      if (!info.ok) {
        console.warn("[post] stored media validation failed", key, info.code);
        await supabase.storage.from(POST_MEDIA_BUCKET).remove([key]);
        return null;
      }
      return { key, mime: info.image.mime, size: bytes.length, width: info.image.width, height: info.image.height, alt: safeAlt || undefined };
    }),
  );

  if (mediaSpecs.some((s) => s === null)) {
    return { status: "error", code: "photo_unreadable" };
  }

  // 5. Publish metadata -------------------------------------------------------
  const { error: rpcError } = await supabase.rpc("create_post", {
    p_body: safeBody,
    p_media: mediaSpecs,
  });

  if (rpcError) {
    console.error("[post] create_post failed", rpcError.message);
    await supabase.storage.from(POST_MEDIA_BUCKET).remove(safeKeys);
    return { status: "error", code: "post_failed" };
  }

  // 6. Revalidate --------------------------------------------------------------
  const locale = await getLocale();
  revalidatePath(`/${locale}`);
  revalidatePath(`/${locale}/profile`);

  return { status: "success", code: "post_published" };
}
