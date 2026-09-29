/**
 * Byte-level video inspection — the twin of `image.ts`.
 *
 * The server is authoritative here too: a client can claim any MIME type, so
 * the *container* is read from the actual bytes before a row exists. What is
 * deliberately NOT read from the bytes is the display size: a phone clip's
 * dimensions live in the container's track header, but the browser's
 * `<video>` metadata probe reports the *display* size (it applies the rotation
 * matrix that a raw parse would miss), so the composer sends it and the
 * publish action bounds it. A file whose bytes are not a real MP4/MOV/WebM
 * container is rejected here no matter what the composer claimed.
 *
 * Pure functions — fully unit-tested.
 */

import {
  MAX_VIDEO_BYTES,
  MIN_VIDEO_DIMENSION,
  type AcceptedStoryVideoMime,
} from "./limits.ts";

export type SniffedVideo = {
  mime: AcceptedStoryVideoMime;
  /** Container brand or doctype that identified it, for logs and tests. */
  container: string;
};

export type VideoDimensions = { width: number; height: number };

export type VideoValidation =
  | { ok: true; video: SniffedVideo; width: number; height: number }
  | { ok: false; code: VideoErrorCode };

/**
 * Shared with the photo path on purpose: one media policy, one set of codes
 * the composers already translate (`photo_*` is the app's media-policy code
 * family, images and videos alike).
 */
export type VideoErrorCode =
  | "photo_wrong_type"
  | "photo_too_large"
  | "photo_too_small"
  | "photo_unreadable";

function ascii(bytes: Uint8Array, from: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(from, from + length));
}

/**
 * ISO base media file format (`ftyp` box): MP4 and QuickTime both start
 * `....ftyp<major-brand>`. The major brand identifies the container, with the
 * compatible-brands list as a fallback — cameras write both.
 */
const MP4_BRANDS = new Set([
  "isom",
  "iso2",
  "iso4",
  "iso5",
  "iso6",
  "mp41",
  "mp42",
  "mp71",
  "avc1",
  "dash",
  "mmp4",
  "M4V ",
  "M4A ",
  "3gp4",
  "3gp5",
  "3g2a",
  "MSNV",
  "NDAS",
]);

function sniffIsoBmff(bytes: Uint8Array): SniffedVideo | null {
  if (bytes.length < 16 || ascii(bytes, 4, 4) !== "ftyp") return null;

  const majorBrand = ascii(bytes, 8, 4);
  if (majorBrand === "qt  ") return { mime: "video/quicktime", container: "qt  " };

  if (MP4_BRANDS.has(majorBrand)) {
    return { mime: "video/mp4", container: majorBrand };
  }

  // Unknown major brand: accept only when the compatible list names a known
  // brand, so a stray box layout cannot pass as a video.
  for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
    const brand = ascii(bytes, offset, 4);

    if (brand === "qt  ") return { mime: "video/quicktime", container: "qt  " };
    if (MP4_BRANDS.has(brand)) return { mime: "video/mp4", container: brand };
  }

  return null;
}

const EBML_SIGNATURE = [0x1a, 0x45, 0xdf, 0xa3];

/**
 * Matroska/WebM: an EBML header whose DocType string is `webm` (or `matroska`
 * — the same container with a different doctype, which browsers play). The
 * doctype sits in the header in plain ASCII, so a bounded scan is enough and
 * needs no full EBML element walk.
 */
function sniffEbml(bytes: Uint8Array): SniffedVideo | null {
  if (bytes.length < 8) return null;
  if (!EBML_SIGNATURE.every((byte, index) => bytes[index] === byte)) return null;

  const header = ascii(bytes, 0, Math.min(bytes.length, 128));

  if (header.includes("webm")) return { mime: "video/webm", container: "webm" };
  if (header.includes("matroska")) {
    return { mime: "video/webm", container: "matroska" };
  }

  return null;
}

/**
 * Recognises MP4 / MOV / WebM from their bytes. Returns null for anything else
 * — including a real video of another container (AVI, MKV files that are not
 * webm-compatible) or a renamed non-video file.
 */
export function sniffVideo(bytes: Uint8Array): SniffedVideo | null {
  return sniffIsoBmff(bytes) ?? sniffEbml(bytes);
}

/** True when both sides clear the story minimum (200 px — the same as photos). */
function hasUsableDimensions(
  dimensions: VideoDimensions | null,
): dimensions is VideoDimensions {
  if (!dimensions) return false;

  return (
    dimensions.width >= MIN_VIDEO_DIMENSION &&
    dimensions.height >= MIN_VIDEO_DIMENSION
  );
}

/**
 * The full story-video policy: a real MP4/MOV/WebM container, ≤ 50 MB, and
 * display dimensions of at least 200 px per side (taken from the browser probe,
 * because only the browser applies the rotation matrix).
 *
 * `size` is passed separately so callers (and tests) can assert on a large file
 * without allocating it, and `dimensions` is null when the probe failed — a
 * clip the browser cannot measure is one we cannot frame, so it is refused
 * rather than stored blind.
 */
export function validateVideoBytes(
  bytes: Uint8Array,
  size = bytes.length,
  dimensions: VideoDimensions | null = null,
): VideoValidation {
  const video = sniffVideo(bytes);

  if (!video) {
    return { ok: false, code: "photo_unreadable" };
  }

  if (size <= 0 || size > MAX_VIDEO_BYTES) {
    return { ok: false, code: "photo_too_large" };
  }

  if (!hasUsableDimensions(dimensions)) {
    return { ok: false, code: "photo_too_small" };
  }

  return {
    ok: true,
    video,
    width: dimensions.width,
    height: dimensions.height,
  };
}
