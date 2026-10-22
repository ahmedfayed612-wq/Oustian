/**
 * Voice message policy — the single source of truth the client validator,
 * the preview, the server action and the database backstop all agree on.
 */

export const MAX_VOICE_DURATION_MS = 300_000; // 5 minutes

/**
 * Byte ceiling for one voice message. The bucket is the outer guard; the
 * client and the server action are the per-send backstop. 5 MB is the
 * initial upload limit — about 2-3 minutes of Opus at 24-32 kbps mono,
 * leaving headroom for slower mobile connections.
 */
export const MAX_VOICE_BYTES = 5 * 1024 * 1024;

/** Private bucket that holds the recorded audio. Browser -> Storage only. */
export const VOICE_BUCKET = "voice";

/** Accepted container MIME types (the bucket's allow-list). */
export const VOICE_MIMES = [
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
] as const;

export type VoiceMime = (typeof VOICE_MIMES)[number];

export function isVoiceMime(value: string): value is VoiceMime {
  return (VOICE_MIMES as readonly string[]).includes(value);
}

/**
 * `MediaRecorder` reports codec-qualified types (`audio/webm;codecs=opus`)
 * and browser aliases (`audio/opus`) that the bucket's allow-list rejects.
 * Map a recorder MIME to the container MIME the bucket accepts, or null when
 * it is not a voice format we can store.
 */
const MIME_NORMALIZATION: Record<string, VoiceMime> = {
  "audio/opus": "audio/webm",
  "audio/webm;codecs=opus": "audio/webm",
  "audio/webm": "audio/webm",
  "audio/mp4;codecs=mp4a.40.2": "audio/mp4",
  "audio/mp4": "audio/mp4",
  "audio/aac": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/ogg;codecs=opus": "audio/ogg",
  "audio/ogg": "audio/ogg",
  "audio/mpeg": "audio/mpeg",
  "audio/wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/wave": "audio/wav",
};

export function normalizeVoiceMime(mime: string): VoiceMime | null {
  return MIME_NORMALIZATION[mime] ?? (isVoiceMime(mime) ? mime : null);
}

/** Extension used for the stored object per container MIME. */
export const VOICE_EXTENSION_BY_MIME: Record<VoiceMime, string> = {
  "audio/webm": "webm",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/ogg": "ogg",
  "audio/wav": "wav",
};

/** One render tick, in milliseconds, that the waveform canvas draws at. */
export const WAVEFORM_CANVAS_MS = 256;
