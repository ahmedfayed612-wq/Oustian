import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeWaveformSamples,
  deterministicWaveform,
} from "./waveform.ts";
import {
  MAX_VOICE_BYTES,
  MAX_VOICE_DURATION_MS,
  isVoiceMime,
  normalizeVoiceMime,
  VOICE_MIMES,
} from "./voice-constants.ts";

describe("voice waveform", () => {
  it("computes RMS amplitudes from a silent buffer", () => {
    const silent = new Float32Array(2400 * 4);
    const out = computeWaveformSamples(silent, 2400);
    assert.equal(out.length, 4);
    for (const v of out) assert.equal(v, 0);
  });

  it("normalises a loud buffer to 0..1", () => {
    const data = new Float32Array(2400 * 8);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.sin((i / data.length) * Math.PI * 2) * 0.5;
    }
    const out = computeWaveformSamples(data, 2400);
    assert.equal(out.length, 8);
    for (const v of out) assert.ok(v >= 0 && v <= 1);
  });

  it("returns an empty array when there is less than one window", () => {
    const small = new Float32Array(100);
    assert.equal(computeWaveformSamples(small, 2400).length, 0);
  });

  it("builds a deterministic fallback of the requested size", () => {
    const wave = deterministicWaveform(256);
    assert.equal(wave.length, 256);
    for (const v of wave) assert.ok(v >= 0 && v <= 1);
  });
});

describe("voice policy", () => {
  it("recognises the stored voice containers", () => {
    for (const mime of VOICE_MIMES) assert.ok(isVoiceMime(mime));
    assert.equal(isVoiceMime("audio/mpeg"), true);
    assert.equal(isVoiceMime("audio/opus"), false);
  });

  it("normalises recorder mimes to the bucket allow-list", () => {
    assert.equal(normalizeVoiceMime("audio/webm;codecs=opus"), "audio/webm");
    assert.equal(normalizeVoiceMime("audio/mp4;codecs=mp4a.40.2"), "audio/mp4");
    assert.equal(normalizeVoiceMime("audio/aac"), "audio/mp4");
    assert.equal(normalizeVoiceMime("audio/x-wav"), "audio/wav");
    assert.equal(normalizeVoiceMime("video/webm"), null);
  });

  it("keeps the size and duration bounds within the voice-message spec", () => {
    assert.ok(MAX_VOICE_BYTES <= 5 * 1024 * 1024);   // 5 MB initial upload limit
    assert.ok(MAX_VOICE_DURATION_MS <= 300_000);     // 5-minute maximum
  });
});
