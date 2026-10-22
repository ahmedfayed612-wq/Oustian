"use client";

import { deterministicWaveform } from "@/features/chat/waveform";
import { WAVEFORM_CANVAS_MS } from "@/features/chat/voice-constants";
import { useMemo } from "react";

/**
 * Compact SVG waveform with a clear played-vs-unplayed split.
 *
 * `data` is the array of normalised amplitudes (0..1) produced by the recorder
 * or the deterministic fallback. `positionMs` slides the drawn window so the
 * played portion reads left-to-right. `durationMs` is the full clip length.
 *
 * The component renders a fixed-height chart, so a short recording and a
 * long one occupy the same width — only the *filled* fraction changes.
 */

export interface VoiceWaveformProps {
  /** Normalised amplitudes (0..1). May be empty or null for the fallback. */
  data?: number[];
  /** How far the clip has played, in milliseconds. Must be <= durationMs. */
  positionMs?: number;
  /** Total clip length in milliseconds. */
  durationMs: number;
  /** True while the current track is playing. Drives the smooth progress line. */
  playing?: boolean;
  /** Small extra height so the waveform never visually touches neighbouring rows. */
  height?: number;
}

export function VoiceWaveform({
  data = [],
  positionMs = 0,
  durationMs,
  playing = false,
  height = 48,
}: VoiceWaveformProps) {
  const points = useMemo(() => {
    if (data.length === 0) return deterministicWaveform(128);
    return data;
  }, [data]);

  const width = Math.max(1, points.length * WAVEFORM_CANVAS_MS);
  const effectivePositionMs = Math.min(positionMs, durationMs);
  const playedWidth = ((effectivePositionMs / durationMs) * width) || 0;

  return (
    <svg
      className="overflow-hidden"
      width={width || 1}
      height={height}
      aria-hidden={true}
      role="presentation"
    >
      <defs>
        <linearGradient id="voice-wave-gradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.35} />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* Unplayed background band. */}
      {playedWidth < width && (
        <rect
          x={playedWidth}
          y={0}
          width={Math.max(0, width - playedWidth)}
          height={height}
          fill="var(--surface)"
          stroke="var(--border)"
          strokeWidth={1}
        />
      )}

      {/* Peak curve across the whole clip. */}
      {points.map((amp, i) => {
        const x = i * WAVEFORM_CANVAS_MS;
        const h = Math.max(1, amp * (height - 4) + 2);
        return <rect key={i} x={x} y={height - h} width={WAVEFORM_CANVAS_MS - 1} height={h} rx={1} fill="var(--brand)" />;
      })}

      {/* Played portion fill. */}
      <rect
        x={0}
        y={0}
        width={Math.min(playedWidth, width)}
        height={height}
        fill="url(#voice-wave-gradient)"
        opacity={playing ? 0.28 : 0.14}
      />

      <line
        x1={playedWidth}
        y1={0}
        x2={playedWidth}
        y2={height}
        stroke="var(--border-strong)"
        strokeWidth={1}
        strokeDasharray="4 3"
      />
    </svg>
  );
}
