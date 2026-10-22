"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useVoicePlayback } from "@/features/chat/components/VoicePlaybackContext";
import { VoiceWaveform } from "./VoiceWaveform";
import { IconButton } from "@/components/ui/IconButton";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize2,
} from "lucide-react";

const PLAYBACK_RATES = [1, 1.5, 2] as const;

export interface VoicePlayerProps {
  /** Audio source (stored object URL or signed Storage URL). */
  audioUrl: string;
  /** RMS amplitudes for the waveform. Optional; a fallback renders when absent. */
  waveformData?: number[];
  /** Stable id used by the global playback controller. */
  id: string;
  className?: string;
}

export function VoicePlayer({
  audioUrl,
  waveformData,
  id,
  className,
}: VoicePlayerProps) {
  const t = useTranslations("Voice");
  const { play, pause, playingId } = useVoicePlayback();
  const audioRef = useRef<HTMLAudioElement>(null);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [muted, setMuted] = useState(false);
  const [rate, setRate] = useState(1);

  // Bind the audio element to this player's id and the global controller.
  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const onLoadedMetadata = () => setDuration(el.duration);
    const onPlay = () => setHasError(false);
    const onPause = () => setHasError(false);
    const onTimeUpdate = () => setCurrentTime(el.currentTime);
    const onEnd = () => {
      el.currentTime = 0;
      setCurrentTime(0);
    };
    const onError = () => setHasError(true);
    const onVolumeChange = () => {
      el.volume = muted ? 0 : 0.9;
    };

    el.addEventListener("loadedmetadata", onLoadedMetadata);
    el.addEventListener("play", onPlay);
    el.addEventListener("pause", onPause);
    el.addEventListener("timeupdate", onTimeUpdate);
    el.addEventListener("ended", onEnd);
    el.addEventListener("error", onError);
    el.addEventListener("volumechange", onVolumeChange);
    el.volume = muted ? 0 : 0.9;

    return () => {
      el.removeEventListener("loadedmetadata", onLoadedMetadata);
      el.removeEventListener("play", onPlay);
      el.removeEventListener("pause", onPause);
      el.removeEventListener("timeupdate", onTimeUpdate);
      el.removeEventListener("ended", onEnd);
      el.removeEventListener("error", onError);
      el.removeEventListener("volumechange", onVolumeChange);
      // This player is leaving the view (switching / deleting). Do not let it
      // keep injecting clicks into the live stream after it is gone.
      if (playingId === id) pause(id);
    };
  }, [id, muted, playingId, pause]);

  const seekTo = useCallback(
    (clientX: number) => {
      const el = audioRef.current;
      if (!el) return;
      const total = duration || el.duration;
      if (!total) return;
      const rect = el.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const x = (clientX - rect.left) / rect.width;
      if (!x || x < 0 || x > 1) return;
      const next = Math.max(0, Math.min(1, x)) * total;
      el.currentTime = next;
      setCurrentTime(next);
    },
    [duration],
  );

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).tagName === "INPUT") return;
    seekTo(e.clientX);
  };

  const handleRateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = Number(e.target.value);
    setRate(next);
    const el = audioRef.current;
    if (el) el.playbackRate = next;
  };

  const handlePlayPause = () => {
    const el = audioRef.current;
    if (!el) return;
    if (playingId === id) {
      if (el.paused) void el.play();
      else el.pause();
    } else {
      play(id, el);
    }
  };

  const handleReplay = () => {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = 0;
    if (playingId === id) void el.play().catch(() => {});
  };

  const toggleMute = () => {
    setMuted((v) => {
      const next = !v;
      const el = audioRef.current;
      if (el) el.volume = next ? 0 : 0.9;
      return next;
    });
  };

  const formatMs = (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return "--:--";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const progress = duration ? Math.min(1, currentTime / duration) : 0;
  const barWidth = `${Math.max(0, Math.min(1, progress)) * 100}%`;

  return (
    <div className={`voice-player ${className ?? ""}`}>
      <audio ref={audioRef} src={audioUrl} preload="auto" className="hidden" />
      <div className="mb-1 flex items-center gap-2 px-1">
        <IconButton
          label={hasError ? t("playbackFailed") : playingId === id ? t("pause") : t("play")}
          variant="soft"
          onClick={handlePlayPause}
          className="size-10 shrink-0"
        >
          {hasError ? <Maximize2 className="size-4" aria-hidden /> : playingId === id ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
        </IconButton>

        <div className="flex flex-1 items-center gap-2 touch-none select-none">
          <span className="w-14 truncate text-right text-[0.7rem] font-medium text-muted">{formatMs(currentTime)}</span>
          <div
            className="relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-surface-2"
            onClick={handleSeek}
            role="slider"
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={1}
            aria-label={t("seek")}
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "ArrowLeft") {
                const el = audioRef.current;
                if (el) el.currentTime = Math.max(0, el.currentTime - 5);
              }
              if (e.key === "ArrowRight") {
                const el = audioRef.current;
                if (el) el.currentTime = Math.min(el.duration, el.currentTime + 5);
              }
            }}
          >
            <div className="absolute left-0 top-0 h-full rounded-full" style={{ width: barWidth, backgroundColor: hasError ? "var(--danger)" : "var(--brand)" }} />
            {duration > 0 && (
              <div className="absolute top-1/2 -translate-y-1/2 h-4 w-4 -translate-x-1/2 rounded-full border border-current bg-surface shadow-sm" style={{ left: barWidth }} />
            )}
          </div>
          <span className="w-14 text-left text-[0.7rem] font-medium text-muted">{formatMs(duration)}</span>
        </div>

        <div className="flex flex-none items-center gap-1">
          <IconButton
            label={t("startOver")}
            variant="soft"
            onClick={handleReplay}
            disabled={!duration}
            aria-label={t("startOver")}
          >
            <RotateCcw className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label={t("skipForward")}
            variant="soft"
            onClick={() => {
              const el = audioRef.current;
              if (el) el.currentTime = Math.min(el.duration, el.currentTime + 10);
            }}
            aria-label={t("skipForward")}
          >
            <SkipForward className="size-4" aria-hidden />
          </IconButton>
          <IconButton
            label={muted ? t("unmute") : t("mute")}
            variant="soft"
            onClick={toggleMute}
            aria-label={muted ? t("unmute") : t("mute")}
          >
            {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
          </IconButton>
        </div>
      </div>

      <div className="mt-1 flex items-center justify-between gap-2 px-1">
        <VoiceWaveform data={waveformData} positionMs={currentTime} durationMs={duration} playing={playingId === id} />
        <div className="flex flex-none items-center gap-1">
          <span className="text-[0.65rem] uppercase tracking-wider text-muted">{formatMs(duration)}</span>
          <select
            className="voice-rate"
            value={rate}
            onChange={handleRateChange}
            aria-label={t("playbackSpeed")}
          >
            {PLAYBACK_RATES.map((r) => <option key={r} value={r}>{r}×</option>)}
          </select>
        </div>
      </div>

      {hasError ? (
        <p className="mt-1 text-center text-[0.7rem] text-danger">{t("playbackFailed")}</p>
      ) : null}
    </div>
  );
}
