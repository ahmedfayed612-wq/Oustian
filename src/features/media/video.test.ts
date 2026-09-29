import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sniffVideo, validateVideoBytes } from "./video.ts";
import { MAX_VIDEO_BYTES, MIN_VIDEO_DIMENSION } from "./limits.ts";

/** Helper: a minimal ISO-BMFF header (`....ftyp<brand>`) with extra brands. */
function makeIsoBmff(majorBrand: string, compatible: string[] = []): Uint8Array {
  const bytes = new Uint8Array(16 + compatible.length * 4);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, bytes.length, false);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4); // 'ftyp'
  bytes.set([...majorBrand].map((char) => char.charCodeAt(0)), 8);
  view.setUint32(12, 0, false); // minor version
  compatible.forEach((brand, index) => {
    bytes.set([...brand].map((char) => char.charCodeAt(0)), 16 + index * 4);
  });
  return bytes;
}

/** Helper: an EBML header carrying `doctype`. */
function makeWebm(doctype = "webm"): Uint8Array {
  const prefix = [0x1a, 0x45, 0xdf, 0xa3];
  const body = [...`\x42\x86\x81\x01${doctype}`].map((char) =>
    char.charCodeAt(0),
  );
  return Uint8Array.from([...prefix, ...body, ...new Array(32).fill(0)]);
}

describe("story video sniffing", () => {
  it("recognises MP4 brands, QuickTime and WebM", () => {
    assert.equal(sniffVideo(makeIsoBmff("isom"))?.mime, "video/mp4");
    assert.equal(sniffVideo(makeIsoBmff("mp42"))?.mime, "video/mp4");
    assert.equal(sniffVideo(makeIsoBmff("M4V "))?.mime, "video/mp4");
    assert.equal(sniffVideo(makeIsoBmff("qt  "))?.mime, "video/quicktime");
    assert.equal(sniffVideo(makeWebm())?.mime, "video/webm");
  });

  it("falls back to the compatible-brands list for unknown majors", () => {
    const bytes = makeIsoBmff("zzzz", ["isom"]);
    assert.equal(sniffVideo(bytes)?.mime, "video/mp4");

    const apple = makeIsoBmff("zzzz", ["qt  "]);
    assert.equal(sniffVideo(apple)?.mime, "video/quicktime");
  });

  it("rejects renamed non-video files and unknown brands", () => {
    const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a]);
    assert.equal(sniffVideo(jpeg), null);

    const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    assert.equal(sniffVideo(png), null);

    // 'ftyp' at the right offset but no known brand anywhere.
    assert.equal(sniffVideo(makeIsoBmff("zzzz", ["yyyy"])), null);

    // Truncated: an ftyp that has not finished writing its brand.
    assert.equal(sniffVideo(Uint8Array.from([0, 0, 0, 8, 0x66, 0x74])), null);
  });
});

describe("story video validation", () => {
  const big = { width: 1080, height: 1920 };

  it("accepts a real container within the size ceiling", () => {
    const result = validateVideoBytes(makeIsoBmff("isom"), 4_000_000, big);

    assert.equal(result.ok, true);
    assert.equal(result.ok && result.video.mime, "video/mp4");
    assert.equal(result.ok && result.width, 1080);
    assert.equal(result.ok && result.height, 1920);
  });

  it("maps a non-video file to the unreadable code", () => {
    const result = validateVideoBytes(Uint8Array.from([1, 2, 3, 4]), 10, big);

    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.code, "photo_unreadable");
  });

  it("rejects files over the video ceiling and empty files", () => {
    const tooBig = validateVideoBytes(
      makeIsoBmff("isom"),
      MAX_VIDEO_BYTES + 1,
      big,
    );
    assert.equal(!tooBig.ok && tooBig.code, "photo_too_large");

    const empty = validateVideoBytes(makeIsoBmff("isom"), 0, big);
    assert.equal(!empty.ok && empty.code, "photo_too_large");
  });

  it("refuses clips the composer could not measure or that are too small", () => {
    const unmeasured = validateVideoBytes(makeIsoBmff("isom"), 1000, null);
    assert.equal(!unmeasured.ok && unmeasured.code, "photo_too_small");

    const tiny = validateVideoBytes(makeIsoBmff("isom"), 1000, {
      width: MIN_VIDEO_DIMENSION - 1,
      height: 1920,
    });
    assert.equal(!tiny.ok && tiny.code, "photo_too_small");

    const minimum = validateVideoBytes(makeIsoBmff("isom"), 1000, {
      width: MIN_VIDEO_DIMENSION,
      height: MIN_VIDEO_DIMENSION,
    });
    assert.equal(minimum.ok, true);
  });
});
