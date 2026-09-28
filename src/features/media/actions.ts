"use server";

import { requireApprovedMember } from "@/features/auth/session";
import {
  buildMediaKey,
  isAcceptedImageMime,
  POST_MEDIA_BUCKET,
  STORY_MEDIA_BUCKET,
  type AcceptedImageMime,
} from "./limits";
import { createClient } from "@/lib/supabase/server";

export type MediaUploadTicket =
  | { ok: true; path: string; token: string; bucket: string }
  | { ok: false; code: string };

/**
 * Which bucket an upload belongs to. Both are private and share the same
 * object layout (`<user_id>/<uuid>.<ext>`) and byte policy — they differ only
 * in who may read the result, which is enforced by storage policies.
 */
export type MediaUploadPurpose = "post" | "story";

/**
 * Mints a signed upload URL for a photo directly to Supabase Storage.
 * The browser uploads directly without traversing Next.js server payload
 * bounds (~4.5 MB). The key is built here from the authenticated member's id,
 * so the client never chooses where its bytes land.
 */
export async function createMediaUploadTicketAction(
  mime: string,
  purpose: MediaUploadPurpose = "post",
): Promise<MediaUploadTicket> {
  const viewer = await requireApprovedMember();

  if (!isAcceptedImageMime(mime)) {
    return { ok: false, code: "photo_wrong_type" };
  }

  const supabase = await createClient();
  const path = buildMediaKey(viewer.id, mime as AcceptedImageMime);
  const bucket = purpose === "story" ? STORY_MEDIA_BUCKET : POST_MEDIA_BUCKET;

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[media] could not create signed upload url", error?.message);
    return { ok: false, code: "photo_unreadable" };
  }

  return { ok: true, path, token: data.token, bucket };
}

