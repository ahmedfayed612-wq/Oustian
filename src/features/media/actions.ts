"use server";

import { requireApprovedMember } from "@/features/auth/session";
import {
  buildMediaKey,
  isAcceptedImageMime,
  POST_MEDIA_BUCKET,
  type AcceptedImageMime,
} from "./limits";
import { createClient } from "@/lib/supabase/server";

export type MediaUploadTicket =
  | { ok: true; path: string; token: string; bucket: string }
  | { ok: false; code: string };

/**
 * Mints a signed upload URL for a post photo directly to Supabase Storage.
 * The browser uploads directly without traversing Next.js server payload bounds (~4.5MB).
 */
export async function createMediaUploadTicketAction(
  mime: string,
): Promise<MediaUploadTicket> {
  const viewer = await requireApprovedMember();

  if (!isAcceptedImageMime(mime)) {
    return { ok: false, code: "photo_wrong_type" };
  }

  const supabase = await createClient();
  const path = buildMediaKey(viewer.id, mime as AcceptedImageMime);

  const { data, error } = await supabase.storage
    .from(POST_MEDIA_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[media] could not create signed upload url", error?.message);
    return { ok: false, code: "photo_unreadable" };
  }

  return {
    ok: true,
    path,
    token: data.token,
    bucket: POST_MEDIA_BUCKET,
  };
}
