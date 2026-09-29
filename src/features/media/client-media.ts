"use client";

/**
 * Browser-side media inspection.
 *
 * The mirror of `image.ts` / `video.ts`: those run on the server against the
 * stored bytes, these run in the composer so the member gets an answer before
 * anything is uploaded. Two jobs:
 *
 *   1. **Measure** — read the dimensions the preview needs. A clip's size comes
 *      from the browser's own metadata probe (which applies the rotation
 *      matrix, so portrait video is framed correctly).
 *   2. **Re-encode when a format is decodable but not storable** — a phone that
 *      hands us HEIC (or an empty MIME type) is one we can still publish: if
 *      the browser can paint it, we re-encode it to JPEG here so the upload
 *      carries a format the bucket and the server policy both accept. A format
 *      the browser cannot decode returns null, and the composer says so
 *      instead of failing later with a misleading error.
 *
 * Only files whose reported type is *not* one we already accept go through the
 * canvas: JPEG/PNG/WebP/MP4/MOV/WebM bytes are uploaded exactly as picked, so
 * the common path never pays a re-encode (and never risks an EXIF-orientation
 * rewrite).
 */

import {
  isAcceptedImageMime,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  storyMediaKindForMime,
  type StoryMediaKind,
} from "./limits";

export type MediaDimensions = { width: number; height: number };

/** JPEG quality for the re-encode: visually lossless at phone sizes. */
const RE_ENCODE_QUALITY = 0.92;

/**
 * Upper bound for a decode/measure. Normally these resolve in milliseconds;
 * a browser that neither loads nor errors a file it cannot decode (unusual
 * codecs do this) would otherwise leave the composer on "Preparing…" forever,
 * so the wait is bounded and resolves as a failure — which the composer then
 * reports as an unreadable file.
 */
const MEASURE_TIMEOUT_MS = 15_000;

/**
 * Resolves `true` when the element signals `okEvent`, `false` on error or
 * timeout. Listeners are attached **before** `src` is set by the caller, so a
 * cached blob URL that resolves in the same tick still reports back.
 */
function whenMediaReady(
  element: HTMLImageElement | HTMLVideoElement,
  okEvent: "load" | "loadedmetadata",
): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    let settled = false;

    function settle(ok: boolean) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      element.onload = null;
      element.onerror = null;
      element.removeEventListener(okEvent, onOk);
      resolve(ok);
    }

    function onOk() {
      settle(true);
    }

    const timer = window.setTimeout(() => settle(false), MEASURE_TIMEOUT_MS);

    element.onerror = () => settle(false);
    element.addEventListener(okEvent, onOk);
  });
}

/**
 * The kind a picked file is treated as. A file the browser cannot type at all
 * (`""` — some Android pickers) is treated as an image, because that is what
 * the re-encode path can rescue.
 */
export function kindForFile(file: Pick<File, "type">): StoryMediaKind {
  return storyMediaKindForMime(file.type) ?? "image";
}

/** Is this exactly the type we will store — no client-side work needed? */
export function isUploadReady(file: Pick<File, "type">): boolean {
  return storyMediaKindForMime(file.type) !== null;
}

/**
 * Should we try to re-encode? Only for something the picker called an image
 * (or could not type) that is not already storable. Videos are never
 * re-encoded: a browser cannot do it, so an unsupported video container is
 * reported instead.
 */
export function shouldReEncode(file: Pick<File, "type">): boolean {
  if (isAcceptedImageMime(file.type)) return false;
  if (isUploadReady(file)) return false;

  return file.type === "" || file.type.startsWith("image/");
}

/** Per-kind ceiling, so the composer can refuse an oversized file up front. */
export function maxBytesForKind(kind: StoryMediaKind): number {
  return kind === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
}

/** Decodes with `<img>` and resolves null when the browser cannot paint it. */
export async function measureImage(file: File): Promise<MediaDimensions | null> {
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  const loaded = whenMediaReady(image, "load");
  image.src = objectUrl;

  const ok = await loaded;

  const dimensions =
    ok && image.naturalWidth > 0 && image.naturalHeight > 0
      ? { width: image.naturalWidth, height: image.naturalHeight }
      : null;

  URL.revokeObjectURL(objectUrl);

  return dimensions;
}

/**
 * Reads a clip's display dimensions from its metadata. `videoWidth` /
 * `videoHeight` are the oriented size, which is what the preview and the
 * database should record. Returns null when the browser cannot read the file
 * (unknown container, corrupt download), so the composer can refuse it.
 */
export async function measureVideo(
  file: File,
): Promise<MediaDimensions | null> {
  const objectUrl = URL.createObjectURL(file);
  const video = document.createElement("video");

  video.preload = "metadata";
  video.muted = true;
  video.playsInline = true;

  const ready = whenMediaReady(video, "loadedmetadata");
  video.src = objectUrl;
  // Some browsers only fetch metadata once decoding is requested.
  void video.load();

  const ok = await ready;

  const dimensions =
    ok && video.videoWidth > 0 && video.videoHeight > 0
      ? { width: video.videoWidth, height: video.videoHeight }
      : null;

  video.removeAttribute("src");
  URL.revokeObjectURL(objectUrl);

  return dimensions;
}

/**
 * Re-encodes a decodable-but-unstorable image (HEIC from a phone camera, a file
 * the picker could not type) to JPEG. Returns null when the browser cannot
 * decode it — the honest answer, reported to the member as an unsupported file.
 *
 * `createImageBitmap` is used when available because it honours the EXIF
 * orientation flag, so a portrait phone photo is not saved sideways.
 */
export async function reEncodeImageToJpeg(file: File): Promise<File | null> {
  const decoded = await decodeImage(file);
  if (!decoded) return null;

  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;

  const context = canvas.getContext("2d");

  if (!context) {
    decoded.release();
    return null;
  }

  context.drawImage(decoded.source, 0, 0, decoded.width, decoded.height);
  decoded.release();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/jpeg", RE_ENCODE_QUALITY);
  });

  if (!blob) return null;

  return new File([blob], "story.jpg", { type: "image/jpeg" });
}

type DecodedImage = {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
};

async function decodeImage(file: File): Promise<DecodedImage | null> {
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });

      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        release: () => bitmap.close(),
      };
    } catch {
      // Fall through to the <img> decoder below.
    }
  }

  const objectUrl = URL.createObjectURL(file);
  const image = new Image();

  const loaded = whenMediaReady(image, "load");
  image.src = objectUrl;

  const ok = await loaded;

  if (!ok || image.naturalWidth === 0) {
    URL.revokeObjectURL(objectUrl);
    return null;
  }

  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(objectUrl),
  };
}
