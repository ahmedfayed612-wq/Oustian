/**
 * Photo policy — the ONE place client validation, server validation and the
 * database backstop all agree on. Changing a limit means changing it here
 * (the SQL checks in the post_media migration mirror these numbers as the
 * final safety net, exactly like the 5000-char caption bound).
 */

/** Private bucket for post photos (same signed-URL delivery as avatars). */
export const POST_MEDIA_BUCKET = "post-media";

/**
 * Private bucket for story photos. Separate from `post-media` because story
 * visibility is per-connection, not "every approved member" — its reads are
 * gated by story visibility at the storage layer (see the stories migration).
 */
export const STORY_MEDIA_BUCKET = "story-media";

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MIN_IMAGE_DIMENSION = 200; // px, each side
export const MAX_ALT_TEXT_LENGTH = 425;

/**
 * Story video policy. Videos share the image policy's *shape* (accepted types,
 * one ceiling, a minimum display size) but not its numbers: a phone clip is
 * several times the size of a photo. MP4/MOV cover iOS and Android cameras,
 * WebM covers browser-recorded clips — the same three containers the
 * `story-media` bucket allows.
 *
 * The bucket has a single `file_size_limit`, so it carries the video ceiling
 * (50 MB) and `MAX_IMAGE_BYTES` stays the binding limit for photos: the client
 * and the publish action enforce the per-kind bound, the bucket is the outer
 * backstop.
 */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const MIN_VIDEO_DIMENSION = MIN_IMAGE_DIMENSION; // one rule for both kinds

/** Caption overlaid on a story photo (mirrored by the story_media check). */
export const MAX_STORY_CAPTION_LENGTH = 280;

/** Story lifetime. The database default repeats this as `now() + 24 hours`. */
export const STORY_TTL_HOURS = 24;


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

/* ---------------------------------------------------------------------------
 * Story media (photo *or* video)
 *
 * A story accepts what a phone actually produces: a camera photo or a camera
 * clip. Posts stay photo-only (`ACCEPTED_IMAGE_MIME` above) — nothing here
 * changes the feed's policy, and both share the same key layout, the same
 * signed-upload flow and the same server-side byte sniffing.
 * ------------------------------------------------------------------------ */

export const STORY_VIDEO_MIME = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

export type AcceptedStoryVideoMime = (typeof STORY_VIDEO_MIME)[number];

/** Every type the `story-media` bucket allows, images included. */
export const STORY_MEDIA_MIME = [
  ...ACCEPTED_IMAGE_MIME,
  ...STORY_VIDEO_MIME,
] as const;

export type AcceptedStoryMime = (typeof STORY_MEDIA_MIME)[number];

/** Which validator a story upload goes through. */
export type StoryMediaKind = "image" | "video";

/** Value for the story composer's `<input type="file" accept>`. */
export const STORY_ACCEPT_ATTRIBUTE = STORY_MEDIA_MIME.join(",");

const VIDEO_EXTENSION_BY_MIME: Record<AcceptedStoryVideoMime, string> = {
  "video/mp4": "mp4",
  "video/quicktime": "mov",
  "video/webm": "webm",
};

/** All story extensions, with the kind each one maps back to. */
const STORY_KIND_BY_EXTENSION: Record<string, StoryMediaKind> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  webp: "image",
  mp4: "video",
  mov: "video",
  webm: "video",
};

export function isAcceptedStoryMime(
  value: string,
): value is AcceptedStoryMime {
  return (STORY_MEDIA_MIME as readonly string[]).includes(value);
}

export function storyMediaKindForMime(mime: string): StoryMediaKind | null {
  if (isAcceptedImageMime(mime)) return "image";
  if ((STORY_VIDEO_MIME as readonly string[]).includes(mime)) return "video";

  return null;
}

/** The per-kind size ceiling the client and the publish action both apply. */
export function maxBytesForStoryKind(kind: StoryMediaKind): number {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

/**
 * Object key for one story upload: `<owner>/<uuid>.<ext>`. Built here, from the
 * authenticated owner and the *type we will store*, so the extension is always
 * consistent with the stored bytes — and the client's filename is never part
 * of it (same invariant as `buildMediaKey`).
 */
export function buildStoryMediaKey(
  ownerId: string,
  mime: AcceptedStoryMime,
): string {
  if (isAcceptedImageMime(mime)) return buildMediaKey(ownerId, mime);

  return `${ownerId}/${crypto.randomUUID()}.${VIDEO_EXTENSION_BY_MIME[mime]}`;
}

/**
 * The publish action's key-shape guard for stories: a UUID folder that belongs
 * to the caller, a UUID filename, a story extension. The extension is what
 * selects the validator, so this check also decides how the bytes are read
 * back — `storyMediaKindForKey` returns null for anything else.
 */
export function isValidStoryMediaKey(key: string, ownerId: string): boolean {
  return storyMediaKindForKey(key, ownerId) !== null;
}

/**
 * Which media a story key holds — or null when the key is not a valid story
 * key for this owner. This is the single place the extension→kind mapping
 * lives, so the publish action cannot disagree with the key builder.
 */
export function storyMediaKindForKey(
  key: string,
  ownerId: string,
): StoryMediaKind | null {
  const pattern = new RegExp(
    `^${ownerId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.([a-z0-9]+)$`,
  );

  const match = pattern.exec(key);
  if (!match) return null;

  return STORY_KIND_BY_EXTENSION[match[1]] ?? null;
}

