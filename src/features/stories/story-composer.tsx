"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { createMediaUploadTicketAction } from "@/features/media/actions";
import {
  MAX_IMAGE_BYTES,
  MAX_STORY_CAPTION_LENGTH,
  MIN_IMAGE_DIMENSION,
  STORY_TTL_HOURS,
} from "@/features/media/limits";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { createStoryAction } from "./actions";

/**
 * Story composer: Add story → pick a photo → preview → publish.
 *
 * The plumbing mirrors the post composer deliberately (same ticket → direct
 * upload → server-side byte sniffing, same blob preview, same pending/retry
 * states) so there is one upload behaviour to reason about. What differs is the
 * canvas: a story is a single photo, so the preview is sized by the image's own
 * aspect ratio instead of being cropped to a fixed frame.
 */
export function StoryComposer() {
  const t = useTranslations("Stories");
  const tAuth = useTranslations("Auth.errors");
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction] = useActionState(
    createStoryAction,
    initialActionState,
  );

  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ratio, setRatio] = useState<string>("9 / 16");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  useEffect(() => {
    if (state.status === "success") {
      router.push("/");
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  async function handleFileSelect(file: File) {
    setClientError(null);

    if (!file.type.startsWith("image/") || file.size > MAX_IMAGE_BYTES) {
      setClientError(t("composer.photoInvalid"));
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.src = objectUrl;

    await new Promise<void>((resolve) => {
      img.onload = () => resolve();
      img.onerror = () => resolve();
    });

    if (
      img.width > 0 &&
      img.height > 0 &&
      (img.width < MIN_IMAGE_DIMENSION || img.height < MIN_IMAGE_DIMENSION)
    ) {
      URL.revokeObjectURL(objectUrl);
      setClientError(t("composer.photoTooSmall"));
      return;
    }

    // Portrait, landscape and square all render as themselves: the preview box
    // adopts the photo's own ratio rather than cropping to a fixed frame.
    if (img.width > 0 && img.height > 0) {
      setRatio(`${img.width} / ${img.height}`);
    }

    setUploading(true);

    try {
      const ticket = await createMediaUploadTicketAction(file.type, "story");

      if (!ticket.ok) {
        setClientError(
          ticket.code === "photo_wrong_type"
            ? t("composer.photoWrongType")
            : t("composer.photoUnreadable"),
        );
        URL.revokeObjectURL(objectUrl);
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error("[story-composer] upload failed", uploadError.message);
        setClientError(t("composer.photoUnreadable"));
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setPreviewUrl(objectUrl);
      setMediaKey(ticket.path);
    } catch (error) {
      console.error("[story-composer] photo upload error", error);
      setClientError(t("composer.photoUnreadable"));
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }

    setPreviewUrl(null);
    setMediaKey(null);
    setClientError(null);

    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const errorMessage =
    clientError ??
    (state.status === "error"
      ? state.code === "too_many_attempts"
        ? tAuth("too_many_attempts")
        : state.code === "invalid_input"
          ? t("composer.photoRequired")
          : state.code === "photo_too_large"
            ? t("composer.photoTooLarge")
            : state.code === "photo_too_small"
              ? t("composer.photoTooSmall")
              : state.code === "photo_wrong_type"
                ? t("composer.photoWrongType")
                : state.code === "photo_unreadable"
                  ? t("composer.photoUnreadable")
                  : t("composer.failed")
      : null);

  // One photo is required and the button stays disabled while an upload runs:
  // no half-published stories and no double submits.
  const canPublish = Boolean(mediaKey) && !uploading;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="mediaKey" value={mediaKey ?? ""} />
      <input type="hidden" name="caption" value={caption} />

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted">
          {t("composer.visibilityNote")}{" "}
          {t("composer.ttlNote", { hours: STORY_TTL_HOURS })}
        </p>

        {previewUrl ? (
          <div className="flex flex-col gap-2">
            <div
              className="relative mx-auto flex max-h-[28rem] w-full items-center justify-center overflow-hidden rounded-control bg-surface-2"
              style={{ aspectRatio: ratio, maxWidth: "100%" }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
              />
              <button
                type="button"
                onClick={removePhoto}
                aria-label={t("composer.removePhoto")}
                className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-pill bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <label htmlFor="story-caption" className="sr-only">
              {t("composer.captionLabel")}
            </label>
            <div className="flex items-center gap-2">
              <input
                id="story-caption"
                type="text"
                value={caption}
                onChange={(event) =>
                  setCaption(
                    event.target.value.slice(0, MAX_STORY_CAPTION_LENGTH),
                  )
                }
                maxLength={MAX_STORY_CAPTION_LENGTH}
                placeholder={t("composer.captionPlaceholder")}
                className="w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-brand focus:outline-none"
              />
              <span className="shrink-0 text-xs tabular-nums text-muted">
                {caption.length}/{MAX_STORY_CAPTION_LENGTH}
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex flex-col items-center gap-2 rounded-control border border-dashed border-border bg-surface-2/60 px-6 py-10 text-center transition-colors hover:border-border-strong disabled:opacity-60"
          >
            <span className="flex size-11 items-center justify-center rounded-pill bg-brand-soft text-brand">
              <ImageIcon className="size-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-text">
              {t("composer.pickPhoto")}
            </span>
            <span className="text-xs text-muted">{t("composer.pickHint")}</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFileSelect(file);
          }}
        />

        {uploading ? (
          <p className="flex items-center gap-2 text-xs text-muted">
            <Loader2
              className="size-4 animate-spin text-brand"
              aria-hidden="true"
            />
            {t("composer.uploading")}
          </p>
        ) : null}

        {previewUrl ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="self-start rounded-pill px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
          >
            {t("composer.replacePhoto")}
          </button>
        ) : null}

        {errorMessage ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          {t("composer.cancel")}
        </Link>
        <SubmitButton
          pendingLabel={t("composer.publishing")}
          disabled={!canPublish}
        >
          {t("composer.publish")}
        </SubmitButton>
      </div>
    </form>
  );
}

