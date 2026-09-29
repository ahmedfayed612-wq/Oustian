import test from "node:test";
import assert from "node:assert/strict";
import {
  sniffImage,
  validatePhotoBytes,
} from "./image.ts";
import {
  buildMediaKey,
  isValidMediaKey,
  MAX_IMAGE_BYTES,
} from "./limits.ts";

/** Helper: builds a minimal valid PNG header with arbitrary width and height. */
function makePng(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  // PNG signature
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  // IHDR chunk length: 13
  bytes.set([0x00, 0x00, 0x00, 0x0d], 8);
  // 'IHDR'
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width, false);
  view.setUint32(20, height, false);
  // Bit depth 8, truecolor (2), compression 0, filter 0, interlace 0
  bytes.set([8, 2, 0, 0, 0], 24);
  return bytes;
}

/** Helper: builds a minimal valid JPEG with an SOF0 segment. */
function makeJpeg(width: number, height: number): Uint8Array {
  // SOI (2) + SOF0 marker (2) + length (2) + precision (1) + height (2) + width (2) + channels (1)
  const bytes = new Uint8Array(17);
  bytes.set([0xff, 0xd8], 0); // SOI
  bytes.set([0xff, 0xc0], 2); // SOF0
  bytes.set([0x00, 0x0b], 4); // segment length: 11
  bytes[6] = 8; // precision
  const view = new DataView(bytes.buffer);
  view.setUint16(7, height, false);
  view.setUint16(9, width, false);
  bytes[11] = 3; // 3 color components
  return bytes;
}

/** Helper: builds a minimal valid WebP (VP8 lossy) header with width and height. */
function makeWebp(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(30);
  // 'RIFF'
  bytes.set([0x52, 0x49, 0x46, 0x46], 0);
  // File size placeholder
  bytes.set([0x16, 0x00, 0x00, 0x00], 4);
  // 'WEBP'
  bytes.set([0x57, 0x45, 0x42, 0x50], 8);
  // 'VP8 '
  bytes.set([0x56, 0x50, 0x38, 0x20], 12);
  // VP8 chunk size
  bytes.set([0x0a, 0x00, 0x00, 0x00], 16);
  // Frame tag (3 bytes)
  bytes.set([0x00, 0x00, 0x00], 20);
  // Sync code 9d 01 2a
  bytes.set([0x9d, 0x01, 0x2a], 23);
  const view = new DataView(bytes.buffer);
  view.setUint16(26, width & 0x3fff, true);
  view.setUint16(28, height & 0x3fff, true);
  return bytes;
}

test("sniffImage recognizes valid PNG dimensions", () => {
  const png = makePng(800, 600);
  const result = sniffImage(png);
  assert.ok(result);
  assert.equal(result.mime, "image/png");
  assert.equal(result.width, 800);
  assert.equal(result.height, 600);
});

test("sniffImage recognizes valid JPEG dimensions", () => {
  const jpeg = makeJpeg(1920, 1080);
  const result = sniffImage(jpeg);
  assert.ok(result);
  assert.equal(result.mime, "image/jpeg");
  assert.equal(result.width, 1920);
  assert.equal(result.height, 1080);
});

test("sniffImage recognizes valid WebP dimensions", () => {
  const webp = makeWebp(640, 480);
  const result = sniffImage(webp);
  assert.ok(result);
  assert.equal(result.mime, "image/webp");
  assert.equal(result.width, 640);
  assert.equal(result.height, 480);
});

test("sniffImage rejects non-image or unrecognized bytes (e.g. PDF/GIF/text)", () => {
  const fakePdf = new TextEncoder().encode("%PDF-1.5 test file content");
  assert.equal(sniffImage(fakePdf), null);

  const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 10, 0, 10, 0]);
  assert.equal(sniffImage(gif), null);
});

test("validatePhotoBytes enforces dimensions: rejects images smaller than 200px", () => {
  const smallPng = makePng(150, 300);
  const result = validatePhotoBytes(smallPng);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.code, "photo_too_small");
  }
});

test("validatePhotoBytes enforces byte size limit: rejects files > 10MB", () => {
  const validPng = makePng(400, 400);
  const overLimit = validatePhotoBytes(validPng, MAX_IMAGE_BYTES + 1);
  assert.equal(overLimit.ok, false);
  if (!overLimit.ok) {
    assert.equal(overLimit.code, "photo_too_large");
  }
});

test("validatePhotoBytes accepts valid PNG >= 200px and <= 10MB", () => {
  const validPng = makePng(1200, 800);
  const result = validatePhotoBytes(validPng);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.image.mime, "image/png");
    assert.equal(result.image.width, 1200);
    assert.equal(result.image.height, 800);
  }
});

test("buildMediaKey and isValidMediaKey validate key pattern against owner UUID", () => {
  const owner = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const key = buildMediaKey(owner, "image/jpeg");
  assert.ok(isValidMediaKey(key, owner));
  // Key belonging to another user must be rejected
  const otherUser = "11111111-2222-3333-4444-555555555555";
  assert.equal(isValidMediaKey(key, otherUser), false);
  // Traversal attempts must be rejected
  assert.equal(isValidMediaKey(`${owner}/../hack.png`, owner), false);
});
