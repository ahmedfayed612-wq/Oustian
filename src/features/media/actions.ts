"use server";

import { requireApprovedMember } from "@/features/auth/session";
import { POST_MEDIA_BUCKET, buildMediaKey, isAcceptedImageMime } from "./limits";
import { createClient } from "@/lib/supabase/server";

/** Mints a signed upload URL for media directly to Supabase Storage. The browser
 * uploads directly (~4.5 MB is bypassed), the key is built server-side from the
 * authenticated member, and the stored bytes are re-checked on publish. */
export async function createMediaUploadTicketAction(
  mime: string,
  purpose: "post",
): Promise<
  | { ok: true; path: string; token: string; bucket: string }
  | { ok: false; code: string }
> {
  if (purpose !== "post") return { ok: false, code: "invalid_purpose" };

  const viewer = await requireApprovedMember();
  const path = buildMediaKey(viewer.id, mime);
  if (!path) return { ok: false, code: "photo_wrong_type" };

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error(
      `[media] could not create signed upload url in ${POST_MEDIA_BUCKET}`,
      error?.message,
    );
    return { ok: false, code: "photo_unreadable" };
  }

  return { ok: true, path, token: data.token, bucket: POST_MEDIA_BUCKET };
}
