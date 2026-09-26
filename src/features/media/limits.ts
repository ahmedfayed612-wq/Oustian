/**
 * Photo policy — the ONE place client validation, server validation and the
 * database backstop all agree on. Changing a limit means changing it here
 * (the SQL checks in the post_media migration mirror these numbers as the
 * final safety net, exactly like the 5000-char caption bound).
 */

/** Private bucket for post photos (same signed-URL delivery as avatars). */
export const POST_MEDIA_BUCKET = "post-media";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_IMAGE_DIMENSION = 200; // px, each side
export const MAX_ALT_TEXT_LENGTH = 425;

/** V1 publishes one photo per post; the schema already allows more later. */
export const MAX_PHOTOS_PER_POST = 1;

export const ACCEPTED_IMAGE_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type AcceptedImageMime = (typeof ACCEPTED_IMAGE_MIME)[number];

/** Value for the `<input type="file" accept>` attribute. */
export const IMAGE_ACCEPT_ATTRIBUTE = ACCEPTED_IMAGE_MIME.join(",");

const EXTENSION_BY_MIME: Record<AcceptedImageMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function isAcceptedImageMime(value: string): value is AcceptedImageMime {
  return (ACCEPTED_IMAGE_MIME as readonly string[]).includes(value);
}

export function extensionForMime(mime: AcceptedImageMime): string {
  return EXTENSION_BY_MIME[mime];
}

/**
 * Object key for one upload: `<owner>/<uuid>.<ext>`. Built entirely from the
 * authenticated owner and the sniffed type — the client's filename is never
 * part of it, so path manipulation has nothing to grab onto.
 */
export function buildMediaKey(ownerId: string, mime: AcceptedImageMime): string {
  return `${ownerId}/${crypto.randomUUID()}.${extensionForMime(mime)}`;
}

/**
 * The publish action's key-shape guard: a UUID folder that belongs to the
 * caller, a UUID filename, an extension that matches a supported type.
 */
export function isValidMediaKey(key: string, ownerId: string): boolean {
  const pattern = new RegExp(
    `^${ownerId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(jpg|jpeg|png|webp)$`,
  );

  return pattern.test(key);
}
