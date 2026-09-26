/**
 * Byte-level image inspection. The server is authoritative: filenames,
 * extensions and client MIME types are all attacker-controlled, so the
 * publish action reads the real bytes (client does the same check for fast
 * feedback) and the only things trusted are these signatures and the
 * dimensions embedded in them. Pure functions — fully unit-tested.
 */

import {
  MAX_IMAGE_BYTES,
  MIN_IMAGE_DIMENSION,
  type AcceptedImageMime,
} from "./limits.ts";

export type SniffedImage = {
  mime: AcceptedImageMime;
  width: number;
  height: number;
};

export type PhotoErrorCode =
  | "photo_wrong_type"
  | "photo_too_large"
  | "photo_too_small"
  | "photo_unreadable";

export type PhotoValidation =
  | { ok: true; image: SniffedImage }
  | { ok: false; code: PhotoErrorCode };

function matchesSignature(bytes: Uint8Array, signature: number[], at = 0): boolean {
  if (bytes.length < at + signature.length) return false;
  for (let i = 0; i < signature.length; i += 1) {
    if (bytes[at + i] !== signature[i]) return false;
  }
  return true;
}

function ascii(text: string): number[] {
  return [...text].map((char) => char.charCodeAt(0));
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const RIFF = ascii("RIFF");
const WEBP = ascii("WEBP");

function sniffPng(bytes: Uint8Array): { width: number; height: number } | null {
  // Signature (8) + IHDR chunk: length(4) 'IHDR'(4) width(4) height(4).
  if (bytes.length < 24) return null;
  if (!matchesSignature(bytes, ascii("IHDR"), 12)) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16, false);
  const height = view.getUint32(20, false);

  return width > 0 && height > 0 ? { width, height } : null;
}

function sniffJpeg(bytes: Uint8Array): { width: number; height: number } | null {
  if (!matchesSignature(bytes, [0xff, 0xd8, 0xff])) return null;

  // Walk marker segments until a Start-Of-Frame carries the dimensions.
  let offset = 2;

  while (offset + 3 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1; // resync past stray bytes (decoder-grade leniency)
      continue;
    }

    const marker = bytes[offset + 1];

    if (marker === 0xff) {
      offset += 1; // fill byte
      continue;
    }
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2; // standalone, no payload
      continue;
    }
    if (marker === 0xd9 || marker === 0xda) return null; // EOI/SOS before SOF

    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2) return null;

    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 && // DHT
      marker !== 0xc8 && // JPG
      marker !== 0xcc; // DAC

    if (isSof) {
      if (offset + 9 > bytes.length) return null;
      const height = (bytes[offset + 5] << 8) | bytes[offset + 6];
      const width = (bytes[offset + 7] << 8) | bytes[offset + 8];
      return width > 0 && height > 0 ? { width, height } : null;
    }

    offset += 2 + length;
  }

  return null;
}

function sniffWebp(bytes: Uint8Array): { width: number; height: number } | null {
  if (!matchesSignature(bytes, RIFF, 0) || !matchesSignature(bytes, WEBP, 8)) {
    return null;
  }

  const fourcc = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (fourcc === "VP8 ") {
    // Lossy: frame tag (3) + sync code 9d 01 2a + 14-bit width/height.
    if (bytes.length < 30) return null;
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) {
      return null;
    }
    const width = view.getUint16(26, true) & 0x3fff;
    const height = view.getUint16(28, true) & 0x3fff;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (fourcc === "VP8L") {
    // Lossless: signature 0x2f then 14 bits width-1 / 14 bits height-1.
    if (bytes.length < 25 || bytes[20] !== 0x2f) return null;
    const bits = view.getUint32(21, true);
    const width = (bits & 0x3fff) + 1;
    const height = ((bits >>> 14) & 0x3fff) + 1;
    return width > 0 && height > 0 ? { width, height } : null;
  }

  if (fourcc === "VP8X") {
    // Extended: 24-bit canvas size at bytes 24..29.
    if (bytes.length < 30) return null;
    const width = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16));
    const height = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16));
    return width > 0 && height > 0 ? { width, height } : null;
  }

  return null;
}

/**
 * Recognises JPEG / PNG / WebP from their bytes and reads the embedded
 * dimensions. Returns null for anything else — including HEIC/HEIF, GIF and
 * truncated or malformed files (V1 deliberately supports only the three
 * formats the bucket allows).
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (matchesSignature(bytes, PNG_SIGNATURE)) {
    const size = sniffPng(bytes);
    return size ? { mime: "image/png", ...size } : null;
  }

  if (matchesSignature(bytes, [0xff, 0xd8, 0xff])) {
    const size = sniffJpeg(bytes);
    return size ? { mime: "image/jpeg", ...size } : null;
  }

  if (matchesSignature(bytes, RIFF, 0) && matchesSignature(bytes, WEBP, 8)) {
    const size = sniffWebp(bytes);
    return size ? { mime: "image/webp", ...size } : null;
  }

  return null;
}

/**
 * The full V1 photo policy against real bytes: accepted format, ≤ 10 MB,
 * both sides ≥ 200 px. `size` is passed separately so callers (and tests)
 * can assert on a large file without allocating it.
 */
export function validatePhotoBytes(
  bytes: Uint8Array,
  size = bytes.length,
): PhotoValidation {
  const image = sniffImage(bytes);

  if (!image) {
    // A recognised-but-broken file reads as "unreadable"; anything else is
    // simply not a format we accept (GIF, HEIC, PDFs renamed to .jpg…).
    return { ok: false, code: "photo_unreadable" };
  }

  if (size > MAX_IMAGE_BYTES || size <= 0) {
    return { ok: false, code: "photo_too_large" };
  }

  if (image.width < MIN_IMAGE_DIMENSION || image.height < MIN_IMAGE_DIMENSION) {
    return { ok: false, code: "photo_too_small" };
  }

  return { ok: true, image };
}
