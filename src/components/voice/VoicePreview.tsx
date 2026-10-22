"use client";

import { useVoicePlayback } from "@/features/chat/components/VoicePlaybackContext";
import { VoicePlayer } from "./VoicePlayer";
import { IconButton } from "@/components/ui/IconButton";
import { Button } from "@/components/ui/Button";
import { Trash2, RotateCcw, Send, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";

export interface RecordingDraft {
  id: string;
  audioUrl: string;
  durationMs: number;
  fileName: string;
  fileSizeBytes: number;
  mimeType: string;
  waveformData: number[];
  /** Recorded bytes, for the browser → Storage upload on send. */
  blob: Blob;
}

export interface VoicePreviewProps {
  draft: RecordingDraft;
  /** Discards the draft recording (stops playback). */
  onDelete: () => void;
  /** Sends the recording to the conversation. */
  onSend: () => void;
  isSending: boolean;
  error?: string | null;
}

export function VoicePreview({ draft, onDelete, onSend, isSending, error }: VoicePreviewProps) {
  const { stopAll } = useVoicePlayback();
  const t = useTranslations("Voice");

  const formatMs = (ms: number) => {
    if (!Number.isFinite(ms) || ms <= 0) return "--:--";
    const m = Math.floor(ms / 60000);
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const sizeMb = draft.fileSizeBytes > 0 ? (draft.fileSizeBytes / 1048576).toFixed(1) : "0";
  const durationLabel = formatMs(draft.durationMs);

  const handleDelete = () => {
    stopAll();
    onDelete();
  };

  return (
    <div className="voice-preview">
      <div className="flex items-center gap-2 px-1">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-text">
            {t("typeLabel")}
          </p>
          <p className="text-[0.7rem] text-muted">
            {durationLabel} · {sizeMb} MB
          </p>
        </div>

        <div className="flex flex-none items-center gap-1">
          <IconButton label={t("delete")} variant="danger" onClick={handleDelete} aria-label={t("delete")}>
            <Trash2 className="size-4" aria-hidden />
          </IconButton>
          <IconButton label={t("recordAgain")} variant="plain" onClick={onDelete} aria-label={t("recordAgain")}>
            <RotateCcw className="size-4" aria-hidden />
          </IconButton>
        </div>
      </div>

      <div className="mt-1">
        <VoicePlayer
          audioUrl={draft.audioUrl}
          waveformData={draft.waveformData}
          id={draft.id}
        />
      </div>

      {error ? (
        <p className="mt-1 text-center text-[0.7rem] text-danger">{error}</p>
      ) : null}

      <Button
        type="button"
        variant="primary"
        size="lg"
        onClick={onSend}
        isLoading={isSending}
        loadingLabel={t("sending")}
        className="mt-2 size-14 !rounded-full"
      >
        {isSending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <Send className="size-5" aria-hidden />}
        <span className="hidden">{isSending ? t("sending") : t("send")}</span>
      </Button>
    </div>
  );
}
