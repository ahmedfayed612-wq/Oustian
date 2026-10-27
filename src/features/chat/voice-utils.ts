"use client";

/**
 * Browser-side helpers for the voice flow: deterministic recording keys and a
 * short-lived signed URL for playback. Storage access is private — only the
 * sender and their conversation peer can sign a URL — so playback re-signs on
 * demand instead of persisting a permanent public link.
 *
 * Uploads use signed upload URLs so we can report progress, cancel in flight,
 * and retry on failure. Bytes go straight from the browser to the private
 * `voice` bucket — they never touch a Vercel function.
 */

import { createClient } from "@/lib/supabase/client";
import { VOICE_BUCKET } from "./voice-constants";

/**
 * Deterministic object key for a recording: `<owner>/<uuid>.<ext>`. The client
 * filename is never part of the path, so there is nothing to traverse.
 */
export function buildVoicePath(ownerId: string, extension: string): string {
  return `${ownerId}/voice-${crypto.randomUUID()}.${extension}`;
}

/**
 * Progress callback for an in-flight upload. `loaded` and `total` are bytes.
 */
export type VoiceUploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

export type VoiceUploadOptions = {
  /** Called periodically with upload progress (0..100 percent). */
  onProgress?: (p: VoiceUploadProgress) => void;
  /** Abort signal to cancel the upload mid-flight. */
  signal?: AbortSignal;
};

/**
 * Uploads a recorded blob straight to the private `voice` bucket via a signed
 * upload URL, with progress reporting and cancellation support.
 *
 * Returns the stored object path on success. Throws when the upload fails or
 * is aborted; callers should clean up any orphaned blob on abort.
 */
export async function uploadVoiceBlob(
  ownerId: string,
  blob: Blob,
  extension: string,
  mimeType: string,
  opts: VoiceUploadOptions = {},
): Promise<string> {
  const path = buildVoicePath(ownerId, extension);
  const supabase = createClient();

  // Mint a signed upload URL so we can drive the PUT ourselves (progress +
  // cancellation). The bucket policy still enforces owner-folder + mime + size.
  const { data: signed, error: signError } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUploadUrl(path);

  if (signError || !signed) {
    throw new Error(
      `voice upload failed: ${signError?.message ?? "could not sign upload url"}`,
    );
  }

  const { signal, onProgress } = opts;

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          loaded: e.loaded,
          total: e.total,
          percent: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(path);
      } else {
        reject(new Error(`voice upload failed: HTTP ${xhr.status}`));
      }
    });

    xhr.addEventListener("error", () => {
      reject(new Error("voice upload failed: network error"));
    });

    xhr.addEventListener("abort", () => {
      reject(new Error("voice upload cancelled"));
    });

    signal?.addEventListener(
      "abort",
      () => {
        xhr.abort();
      },
      { once: true },
    );

    xhr.open("PUT", signed.signedUrl, true);
    xhr.setRequestHeader("Content-Type", mimeType);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.send(blob);
  });
}

/**
 * Signed URL for a stored voice object. Falls back to null when the path is
 * missing or the caller lacks access, so the player renders an error state
 * instead of hanging.
 */
export async function signedVoiceUrl(
  path: string | null | undefined,
  expiresInSeconds = 60 * 60,
): Promise<string | null> {
  if (!path) return null;

  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(VOICE_BUCKET)
    .createSignedUrl(path, expiresInSeconds);

  if (error) {
    console.error("[voice] failed to sign url", error.message);
    return null;
  }

  return data?.signedUrl ?? null;
}

/** Short, human-readable duration label used by the player and composer. */
export function formatVoiceDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return "0:00";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

/**
 * Deletes a stored voice object. Used for orphan cleanup when a recording is
 * cancelled before the message is committed, or when a voice message is
 * retracted.
 */
export async function deleteVoiceBlob(
  path: string | null | undefined,
): Promise<void> {
  if (!path) return;
  const supabase = createClient();
  await supabase.storage.from(VOICE_BUCKET).remove([path]);
}
