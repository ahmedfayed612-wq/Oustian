"use client";

/**
 * Client-side photo processing for the feed composer.
 *
 * Decodes the picked image with EXIF orientation applied, re-orients so it is
 * stored upright, caps the longest edge at MAX_PROCESSED_DIMENSION, and
 * re-encodes to WebP at WEBP_QUALITY. A thumbnail is produced at
 * THUMBNAIL_MAX_DIMENSION. Redrawing pixels onto a canvas drops EXIF (and
 * with it GPS/location metadata) — the stored bytes are the authority, so no
 * client-supplied type/size/dimensions are trusted server-side.
 *
 * Pure DOM / Web API — unit-testable in jsdom-like environments where
 * createImageBitmap and canvas are available.
 */

import {
  MAX_PROCESSED_DIMENSION,
  OUTPUT_IMAGE_MIME,
  THUMBNAIL_MAX_DIMENSION,
  WEBP_QUALITY,
} from "./limits.ts";

export type ProcessedPhoto = {
  /** Full-resolution WebP, ready to upload as the post's storage object. */
  full: File;
  /** WebP thumbnail, ready to upload alongside the full image. */
  thumb: File;
  width: number;
  height: number;
  thumbWidth: number;
  thumbHeight: number;
};

export type PhotoProcessError = { ok: false; code: "photo_unreadable" };

export type PhotoProcessResult =
  | { ok: true; photo: ProcessedPhoto }
  | { ok: false; code: PhotoProcessError["code"] };

/** Cap the longest edge while preserving aspect ratio. Exported for testing. */
export function fitDimensions(
  width: number,
  height: number,
  maxDim: number,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDim) return { width, height };
  const scale = maxDim / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Draw an image source onto a canvas sized to the target, returning the canvas. */
function renderToCanvas(source: CanvasImageSource, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, w);
  canvas.height = Math.max(1, h);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no 2d context");
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

/** Encode a canvas to a WebP File with a deterministic (owner-less) name. */
function canvasToWebpFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) return reject(new Error("webp encode returned null"));
        resolve(new File([blob], name, { type: OUTPUT_IMAGE_MIME }));
      },
      OUTPUT_IMAGE_MIME,
      WEBP_QUALITY,
    );
  });
}

/**
 * Process a picked image into a full-resolution WebP and a WebP thumbnail.
 * Returns `photo_unreadable` when the browser cannot decode the file.
 */
export async function processImage(
  file: File,
): Promise<PhotoProcessResult> {
  let bitmap: ImageBitmap | null = null;
  try {
    if (typeof createImageBitmap !== "function") {
      return { ok: false, code: "photo_unreadable" };
    }

    // `imageOrientation: "from-image"` applies the EXIF orientation tag so the
    // stored image is upright. Canvas redraw then drops all EXIF/GPS metadata.
    bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    const { width: fullW, height: fullH } = fitDimensions(
      bitmap.width,
      bitmap.height,
      MAX_PROCESSED_DIMENSION,
    );
    const { width: thumbW, height: thumbH } = fitDimensions(
      bitmap.width,
      bitmap.height,
      THUMBNAIL_MAX_DIMENSION,
    );

    const [fullCanvas, thumbCanvas] = await Promise.all([
      renderToCanvas(bitmap, fullW, fullH),
      renderToCanvas(bitmap, thumbW, thumbH),
    ]);

    const [fullFile, thumbFile] = await Promise.all([
      canvasToWebpFile(fullCanvas, `full-${crypto.randomUUID()}.webp`),
      canvasToWebpFile(thumbCanvas, `thumb-${crypto.randomUUID()}.webp`),
    ]);

    return {
      ok: true,
      photo: {
        full: fullFile,
        thumb: thumbFile,
        width: fullW,
        height: fullH,
        thumbWidth: thumbW,
        thumbHeight: thumbH,
      },
    };
  } catch {
    return { ok: false, code: "photo_unreadable" };
  } finally {
    bitmap?.close();
  }
}
