"use client";

/* eslint-disable @typescript-eslint/no-explicit-any -- Web Audio DOM classes used here have no published types in this project's dependency set; the recorder only drives the real MediaRecorder / AudioContext APIs. */
import { useCallback, useEffect, useRef, useState } from "react";
import { waveformFromBlob } from "@/features/chat/waveform";
import {
  MAX_VOICE_DURATION_MS,
  VOICE_EXTENSION_BY_MIME,
  normalizeVoiceMime,
} from "@/features/chat/voice-constants";
import { useVoicePlayback } from "@/features/chat/components/VoicePlaybackContext";
import { VoiceWaveform } from "./VoiceWaveform";
import { IconButton } from "@/components/ui/IconButton";
import { Mic, StopCircle, RotateCcw, Clock, X } from "lucide-react";
import type { RecordingDraft } from "./VoicePreview";

type Status = "idle" | "requesting" | "recording" | "stopping";

/**
 * Records a voice message in the chat composer.
 *
 * Flow:
 *   idle -> (tap mic) requesting -> (mic permission granted) recording ->
 *   (tap stop) stopping -> preview (app owns the `draft` state present)
 *
 * The recorder only ever asks for one thing: a live audio stream. The summary
 * toast now leads — the recording itself is fully optional: the text composer
 * below it stays alive no matter what happens.
 */

export interface VoiceRecorderProps {
  /** Called once the recording becomes a preview the user can confirm. */
  onRecorded: (draft: RecordingDraft) => void;
  /** Called when the user aborts the preview and returns to the composer. */
  onCancelPreview: () => void;
}

export function VoiceRecorder({
  onRecorded,
  onCancelPreview,
}: VoiceRecorderProps) {
  const { stopAll } = useVoicePlayback();

  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [liveAmp, setLiveAmp] = useState<number[]>([]);
  const urlRef = useRef<string | null>(null);
  const startedAtRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<any>(null);
  const analyserRef = useRef<any>(null);
  const timerRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  const stopLiveLoop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (analyserRef.current) {
      analyserRef.current.disconnect();
      analyserRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (recorderRef.current) {
      recorderRef.current = null;
    }
  }, []);

  // Clean up on unmount: release the last object URL and the mic.
  useEffect(() => {
    return () => {
      stopLiveLoop();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, [stopLiveLoop]);

  const selectMimeType = useCallback((): string | null => {
    const candidates = [
      "audio/opus",
      "audio/webm;codecs=opus",
      "audio/mp4;codecs=mp4a.40.2",
      "audio/aac",
      "audio/wav",
    ];
    for (const mime of candidates) {
      if (
        typeof MediaRecorder !== "undefined" &&
        MediaRecorder.isTypeSupported(mime)
      )
        return mime;
    }
    return null;
  }, []);

  const requestPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);
      analyserRef.current = analyser;

      const mimeType = selectMimeType();
      if (!mimeType) {
        setError("nosupported");
        return;
      }
      let mediaRecorder: MediaRecorder;
      try {
        // Request 24–32 kbps mono (upper end of the spec band for quality on
        // slow mobile connections). `audioBitsPerSecond` is a hint; browsers
        // that ignore it still produce a usable Opus/WebM stream.
        mediaRecorder = new MediaRecorder(stream, {
          mimeType,
          audioBitsPerSecond: 32000,
        });
      } catch {
        mediaRecorder = new MediaRecorder(stream);
      }
      recorderRef.current = mediaRecorder;

      chunksRef.current = [];
      setSeconds(0);
      elapsedRef.current = 0;
      setStatus("recording");
      startedRef.current = true;
      startedAtRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onerror = () => {
        setError("recording_failed");
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        if (blob.size === 0) {
          setError("empty_recording");
          setStatus("idle");
          return;
        }
        const storedMime = normalizeVoiceMime(mimeType);
        if (!storedMime) {
          setError("nosupported");
          setStatus("idle");
          return;
        }
        const analysis = await waveformFromBlob(blob, 2400, 15_000);
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        const extension = VOICE_EXTENSION_BY_MIME[storedMime];
        // Honest duration: the decoded buffer when available, the live timer
        // as the backstop, clamped to the 60 s policy. The interval mirrors
        // the timer into `elapsedRef`, so the async handler never reads a
        // stale render snapshot.
        const rawDurationMs =
          analysis && analysis.durationMs > 0
            ? analysis.durationMs
            : elapsedRef.current * 1000;
        const durationMs = Math.max(
          0,
          Math.min(MAX_VOICE_DURATION_MS, Math.round(rawDurationMs)),
        );
        const nextDraft: RecordingDraft = {
          id: `voice-preview-${Date.now()}`,
          audioUrl: url,
          durationMs,
          fileName: `voice.${extension}`,
          fileSizeBytes: blob.size,
          mimeType: storedMime,
          waveformData: analysis?.samples ?? [],
          blob: new Blob(chunksRef.current, { type: storedMime }),
        };
        setError(null);
        // The parent decides what to do with the draft (preview vs send).
        if (onRecorded) onRecorded(nextDraft);
      };

      // Live amplitude: feed it into the waveform display so the mic never
      // feels like a blind button while someone is talking.
      const readAmplitude = () => {
        const analyser = analyserRef.current;
        if (!analyser) return;
        const buffer = new Uint8Array(analyser.fftSize);
        analyser.getByteTimeDomainData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          const v = (buffer[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / buffer.length);
        const amp = Math.min(1, Math.max(0, rms * 1.2));
        setLiveAmp([amp]);
      };

      const liveLoop = () => {
        readAmplitude();
        timerRef.current = window.setTimeout(liveLoop, 80);
      };
      liveLoop();

      await mediaRecorder.start();
    } catch (err) {
      const message = (err as Error)?.message ?? String(err);
      if (message.toLowerCase().includes("notallowed")) {
        setError("permission_denied");
      } else if (message.toLowerCase().includes("notsupported")) {
        setError("microphone_unavailable");
      } else {
        setError("microphone_unavailable");
      }
    }
  }, [selectMimeType, onRecorded]);

  const startRecording = useCallback(() => {
    if (status === "recording" || status === "requesting") return;
    setError(null);
    setStatus("requesting");
    requestPermission()
      .catch(() => {})
      .finally(() => {});
  }, [status, requestPermission]);

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (!recorder) return;
    setStatus("stopping");
    recorder.stop();
  }, []);

  const cancelRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder) {
      try {
        recorder.stop();
      } catch {}
    }
    stopLiveLoop();
    stopAll();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setError(null);
    setStatus("idle");
    setSeconds(0);
    elapsedRef.current = 0;
    startedRef.current = false;
    if (onCancelPreview) onCancelPreview();
  }, [onCancelPreview, stopLiveLoop, stopAll]);

  const elapsedMs = seconds * 1000;

  // Drive the visual timer while we hold the mic. The interval always
  // mirrors the value into `elapsedRef` so the async `onstop` reads the
  // current count instead of a stale `seconds` render value. Hit the 5 min
  // ceiling and the recording stops itself.
  useEffect(() => {
    if (status !== "recording") return;
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => {
        const next = s + 1;
        elapsedRef.current = next;
        if (next * 1000 >= MAX_VOICE_DURATION_MS) {
          try {
            recorderRef.current?.stop();
          } catch {
            // Already stopped.
          }
        }
        return next;
      });
    }, 1000);
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [status]);

  const formatMs = (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return "0:00";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000)
      .toString()
      .padStart(2, "0");
    return `${m}:${s}`;
  };

  return (
    <div className="voice-recorder">
      {(status === "requesting" || status === "recording") && (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <div className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-muted shadow-lift">
            <Clock className="size-3.5" aria-hidden />
            <span>{formatMs(elapsedMs)}</span>
          </div>
        </div>
      )}

      <div className="mb-1 flex items-center gap-2 px-1">
        <IconButton
          label={
            status === "recording"
              ? "Stop recording"
              : status === "requesting"
                ? "Request microphone access"
                : "Record a voice message"
          }
          variant="soft"
          onClick={status === "recording" ? stopRecording : startRecording}
          className="voice-record-button"
          aria-busy={status === "requesting"}
        >
          {status === "recording" ? (
            <StopCircle className="size-4" aria-hidden />
          ) : (
            <Mic className="size-4" aria-hidden />
          )}
        </IconButton>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text">
            Voice message
          </p>
          {status === "requesting" ? (
            <p className="text-[0.7rem] text-muted">
              Requesting microphone access…
            </p>
          ) : status === "recording" ? (
            <VoiceWaveform
              data={liveAmp}
              positionMs={elapsedMs}
              durationMs={elapsedMs}
              playing={false}
              height={40}
            />
          ) : null}
        </div>

        <div className="flex flex-none items-center gap-1">
          {status === "recording" ? (
            <>
              <IconButton
                label="Cancel recording"
                variant="plain"
                onClick={cancelRecording}
                aria-label="Cancel recording"
              >
                <RotateCcw className="size-4" aria-hidden />
              </IconButton>
              <IconButton
                label="Stop recording"
                variant="soft"
                onClick={stopRecording}
                aria-label="Stop recording"
              >
                <StopCircle className="size-4" aria-hidden />
              </IconButton>
            </>
          ) : error ? (
            <IconButton
              label="Dismiss"
              variant="plain"
              onClick={() => setError(null)}
              aria-label="Dismiss"
            >
              <X className="size-4" aria-hidden />
            </IconButton>
          ) : null}
        </div>
      </div>

      {(status === "requesting" || status === "recording") && (
        <div className="mt-1">
          <VoiceWaveform
            data={liveAmp}
            positionMs={elapsedMs}
            durationMs={elapsedMs}
            playing={false}
            height={40}
          />
        </div>
      )}

      {error ? (
        <p className="mt-1 text-center text-[0.7rem] text-danger">
          {(() => {
            switch (error) {
              case "permission_denied":
                return "Microphone access was denied. Open Settings to allow microphone access for this site — text messages still work.";
              case "nosupported":
                return "Your browser does not support voice recording. Please use a supported browser.";
              case "microphone_unavailable":
                return "Microphone is unavailable or already in use. Check permissions and try again.";
              case "empty_recording":
                return "The recording is empty — try again with a longer clip.";
              case "recording_failed":
                return "Recording failed — please try again.";
              default:
                return "Unable to record a voice message. Please try again.";
            }
          })()}
        </p>
      ) : null}
    </div>
  );
}
