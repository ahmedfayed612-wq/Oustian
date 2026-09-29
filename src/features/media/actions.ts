"use server";

import { requireApprovedMember } from "@/features/auth/session";
import {
  buildMediaKey,
  buildStoryMediaKey,
  isAcceptedImageMime,
  isAcceptedStoryMime,
  POST_MEDIA_BUCKET,
  STORY_MEDIA_BUCKET,
  type AcceptedImageMime,
} from "./limits.ts";
import { createClient } from "@/lib/supabase/server";

export type MediaUploadTicket =
  | { ok: true; path: string; token: string; bucket: string }
  | { ok: false; code: string };

/**
 * Which bucket an upload belongs to. Both are private and share the same
 * object layout (`<user_id>/<uuid>.<ext>`); they differ in who may read the
 * result (storage policies) and in what they accept: a post is a photo, a
 * story is a photo or a clip.
 */
export type MediaUploadPurpose = "post" | "story";

/**
 * Mints a signed upload URL for media directly to Supabase Storage.
 * The browser uploads directly without traversing Next.js server payload
 * bounds (~4.5 MB). The key is built here from the authenticated member's id
 * and the type we intend to store, so the client never chooses where its bytes
 * land — and the bytes themselves are re-checked server-side on publish.
 */
export async function createMediaUploadTicketAction(
  mime: string,
  purpose: MediaUploadPurpose = "post",
): Promise<MediaUploadTicket> {
  const viewer = await requireApprovedMember();

  const path =
    purpose === "story"
      ? storyKeyFor(viewer.id, mime)
      : postKeyFor(viewer.id, mime);

  if (!path) return { ok: false, code: "photo_wrong_type" };

  const bucket = purpose === "story" ? STORY_MEDIA_BUCKET : POST_MEDIA_BUCKET;

  const supabase = await createClient();

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error(
      `[media] could not create signed upload url in ${bucket}`,
      error?.message,
    );
    return { ok: false, code: "photo_unreadable" };
  }

  return { ok: true, path, token: data.token, bucket };
}

/** Posts and avatars are photos; a story takes photos and videos. */
function postKeyFor(ownerId: string, mime: string): string | null {
  if (!isAcceptedImageMime(mime)) return null;

  return buildMediaKey(ownerId, mime as AcceptedImageMime);
}

function storyKeyFor(ownerId: string, mime: string): string | null {
  if (!isAcceptedStoryMime(mime)) return null;

  return buildStoryMediaKey(ownerId, mime);
}


