"use client";

import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import { VoicePlayer } from "@/components/voice/VoicePlayer";
import { signedVoiceUrl } from "../voice-utils";

type MessageLike = {
  id: string;
  sender_id: string;
  created_at: string;
  audio_path?: string | null;
  duration_ms?: number | null;
  waveform_data?: unknown;
};

/**
 * Renders a single voice message inside the thread. The signed playback URL is
 * resolved only when the message is on screen (no audio is prefetched), and the
 * bubble collapses to an error state when the object is missing, expired or
 * access was revoked.
 */
export function VoiceMessageBubble({
  message,
  meId,
}: {
  message: MessageLike;
  meId: string;
}) {
  const t = useTranslations("Voice");
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const signed = await signedVoiceUrl(message.audio_path);
      if (!alive) return;
      if (signed) setUrl(signed);
      else setError(true);
    })();
    return () => {
      alive = false;
    };
  }, [message.audio_path]);

  const waveformData = Array.isArray(message.waveform_data)
    ? (message.waveform_data as number[])
    : [];

  return (
    <div className="voice-bubble flex min-w-0 flex-col gap-1">
      {error || !url ? (
        <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-xs text-muted">
          <TriangleAlert className="size-4" aria-hidden />
          <span>{t("voiceUnavailable")}</span>
        </div>
      ) : (
        <VoicePlayer
          audioUrl={url}
          waveformData={waveformData}
          id={`msg-${message.id}`}
        />
      )}

      <div className="flex items-center justify-end gap-2 text-[0.65rem] text-muted">
        <time dateTime={message.created_at}>
          {new Date(message.created_at).toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })}
        </time>
        <span>{message.sender_id === meId ? t("you") : t("peer")}</span>
      </div>
    </div>
  );
}
