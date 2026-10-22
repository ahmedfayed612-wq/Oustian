/**
 * Waveform generation for voice messages.
 *
 * The visual never needs the full audio file in memory: `decodeAudioData` hands
 * us a small `AudioBuffer`, we reduce it to a compact array of RMS amplitudes,
 * and the canvas only draws that short array. If decoding fails (unsupported
 * codec, corrupt blob), the caller falls back to a deterministic visualisation
 * so the interface never breaks.
 */

export interface AudioBufferLike {
  numberOfChannels: number;
  /** Seconds of decoded audio (may be 0 for a degenerate buffer). */
  duration: number;
  sampleRate: number;
  getChannelData(channel: number): Float32Array;
}

/**
 * Pure RMS reduction. Takes raw `Float32Array` samples + channel count so it
 * can be unit tested in Node without a DOM. Returns `[]` when there is not
 * enough data for even one window.
 */
export function computeWaveformSamples(
  data: Float32Array,
  samplesPerPoint = 2400,
): number[] {
  const count = Math.floor(data.length / samplesPerPoint);
  if (count === 0) return [];

  const out = new Array<number>(count);
  let max = 0;

  for (let i = 0; i < count; i++) {
    let sum = 0;
    const start = i * samplesPerPoint;
    for (let j = 0; j < samplesPerPoint; j++) {
      const v = data[start + j];
      sum += v * v;
    }
    const rms = Math.sqrt(sum / samplesPerPoint);
    out[i] = rms;
    if (rms > max) max = rms;
  }

  // Normalise to 0..1 so the drawing scale tracks the loudest moment instead
  // of the current volume. A completely silent clip is left as all-zeros and
  // the caller substitutes the deterministic fallback.
  if (max > 0) {
    for (let i = 0; i < out.length; i++) out[i] = out[i] / max;
  }
  return out;
}

/** RMS reduction over an `AudioBuffer` (browser / worker). */
export function generateWaveform(buffer: AudioBufferLike, samplesPerPoint = 2400): number[] {
  const data = buffer.getChannelData(0);
  return computeWaveformSamples(data, samplesPerPoint);
}

/**
 * Decode a recorded blob and produce a waveform *with* the decoded duration.
 * Returns `null` when the blob cannot be decoded or the decode times out —
 * the caller keeps the fallback visualisation and the raw timer.
 */
export async function waveformFromBlob(
  blob: Blob,
  samplesPerPoint = 2400,
  timeoutMs = 15_000,
): Promise<{ samples: number[]; durationMs: number } | null> {
  try {
    const ctx = new AudioContext();
    const arrayBuffer = await blob.arrayBuffer();
    const decoded = await Promise.race([
      ctx.decodeAudioData(arrayBuffer) as Promise<AudioBufferLike>,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("decode timed out")), timeoutMs)),
    ]);
    const samples = generateWaveform(decoded, samplesPerPoint);
    const durationMs = Math.round((decoded.duration || 0) * 1000);
    await ctx.close();
    return { samples, durationMs };
  } catch {
    return null;
  }
}

/**
 * Deterministic fallback waveform. A handful of phase-shifted sine traces plus
 * a slight noise floor are guaranteed to render a structured, readable shape
 * even when the audio cannot be decoded or no metadata exists for a message.
 */
export function deterministicWaveform(length: number): number[] {
  if (length <= 0) return [];
  const out = new Array<number>(length);

  for (let i = 0; i < length; i++) {
    let v = 0;
    for (let o = 0; o < 3; o++) {
      const phase = (i + o * 7) / length;
      v += Math.sin(phase * Math.PI * 2 * (12 + o * 5)) * (1 - o * 0.25);
    }
    out[i] = Math.max(0, Math.min(1, (v / 3) * 0.8 + 0.1));
  }
  return out;
}
