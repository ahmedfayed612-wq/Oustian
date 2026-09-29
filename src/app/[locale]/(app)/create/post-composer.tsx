"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { createPostAction } from "@/features/feed/actions";
import { createMediaUploadTicketAction } from "@/features/media/actions";
import {
  MAX_ALT_TEXT_LENGTH,
  MAX_IMAGE_BYTES,
  MIN_IMAGE_DIMENSION,
} from "@/features/media/limits";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

const MAX_POST_LENGTH = 5000;

/**
 * The full-screen composer (`/create`). Publishing is a server action (the
 * one place that can rate-limit before insert); everything else stays client
 * for instant feedback. On success the member lands back on the feed.
 */
export function PostComposer({
  me,
}: {
  me: { fullName: string; avatarUrl: string | null };
}) {
  const t = useTranslations("Composer");
  const tAuth = useTranslations("Auth.errors");
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [state, formAction] = useActionState(
    createPostAction,
    initialActionState,
  );
  const [body, setBody] = useState("");

  // Attached photo state
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
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

    if (file.size > MAX_IMAGE_BYTES) {
      setClientError(t("photoTooLarge"));
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
      setClientError(t("photoTooSmall"));
      return;
    }

    setUploading(true);

    try {
      const ticket = await createMediaUploadTicketAction(file.type);

      if (!ticket.ok) {
        if (ticket.code === "photo_wrong_type") {
          setClientError(t("photoWrongType"));
        } else {
          setClientError(t("photoUnreadable"));
        }
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
        console.error("[composer] upload to signed url failed", uploadError.message);
        setClientError(t("photoUnreadable"));
        URL.revokeObjectURL(objectUrl);
        return;
      }

      setPreviewUrl(objectUrl);
      setMediaKey(ticket.path);
    } catch (err) {
      console.error("[composer] photo upload error", err);
      setClientError(t("photoUnreadable"));
      URL.revokeObjectURL(objectUrl);
    } finally {
      setUploading(false);
    }
  }

  function removeAttachedPhoto() {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setMediaKey(null);
    setAltText("");
    setClientError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const errorMessage =
    clientError ??
    (state.status === "error"
      ? state.code === "too_many_attempts"
        ? tAuth("too_many_attempts")
        : state.code === "invalid_input"
          ? t("empty")
          : state.code === "photo_too_large"
            ? t("photoTooLarge")
            : state.code === "photo_too_small"
              ? t("photoTooSmall")
              : state.code === "photo_wrong_type"
                ? t("photoWrongType")
                : state.code === "photo_unreadable"
                  ? t("photoUnreadable")
                  : t("failed")
      : null);

  const canPublish =
    (body.trim().length > 0 || Boolean(mediaKey)) && !uploading;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="mediaKey" value={mediaKey ?? ""} />
      <input type="hidden" name="altText" value={altText} />

      <Card className="flex flex-col gap-3 p-4">
        <div className="flex gap-3">
          <Avatar size="md" name={me.fullName} src={me.avatarUrl} />

          <div className="min-w-0 flex-1">
            <label htmlFor="post-body" className="sr-only">
              {t("placeholder")}
            </label>
            <textarea
              id="post-body"
              name="body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={t("placeholder")}
              rows={4}
              maxLength={MAX_POST_LENGTH}
              className="w-full resize-y rounded-control border border-border bg-surface-2 px-3.5 py-3 text-[0.9375rem] leading-relaxed text-text placeholder:text-muted focus:border-brand focus:outline-none"
            />
          </div>
        </div>

        {/* Uploaded photo preview & alt text */}
        {previewUrl ? (
          <div className="mt-1 flex flex-col gap-2 rounded-control border border-border bg-surface-2/60 p-3">
            <div className="relative flex max-h-80 items-center justify-center overflow-hidden rounded-md bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt={altText || t("photoPreview")}
                className="max-h-72 w-auto object-contain"
              />
              <button
                type="button"
                onClick={removeAttachedPhoto}
                aria-label={t("removePhoto")}
                className="absolute top-2 right-2 flex size-8 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-brand"
              >
                <X className="size-4" aria-hidden="true" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="alt-text" className="sr-only">
                {t("altPlaceholder")}
              </label>
              <input
                id="alt-text"
                type="text"
                value={altText}
                onChange={(e) =>
                  setAltText(e.target.value.slice(0, MAX_ALT_TEXT_LENGTH))
                }
                maxLength={MAX_ALT_TEXT_LENGTH}
                placeholder={t("altPlaceholder")}
                className="w-full rounded-control border border-border bg-surface px-3 py-1.5 text-xs text-text placeholder:text-muted focus:border-brand focus:outline-none"
              />
              <span className="shrink-0 text-[10px] tabular-nums text-muted">
                {altText.length}/{MAX_ALT_TEXT_LENGTH}
              </span>
            </div>
          </div>
        ) : null}

        {uploading ? (
          <div className="flex items-center gap-2 py-2 text-xs text-muted">
            <Loader2 className="size-4 animate-spin text-brand" />
            <span>{t("uploadingPhoto")}</span>
          </div>
        ) : null}

        <div className="flex items-center justify-between border-t border-border/60 pt-2 text-xs text-muted">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              id="photo-upload-input"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                // Clear the input so re-picking the *same* file (after a
                // failure, or to retry) fires `change` again instead of
                // silently doing nothing.
                e.target.value = "";
              }}
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-pill px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
            >
              <ImageIcon className="size-4 text-brand" aria-hidden="true" />
              <span>{previewUrl ? t("changePhoto") : t("addPhoto")}</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="shrink-0 tabular-nums">
              {t("counter", { count: body.length })}
            </span>
          </div>
        </div>

        {errorMessage ? (
          <p role="alert" className="text-sm text-danger">
            {errorMessage}
          </p>
        ) : null}
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          {t("cancel")}
        </Link>
        <SubmitButton pendingLabel={t("publishing")} disabled={!canPublish}>
          {t("publish")}
        </SubmitButton>
      </div>
    </form>
  );
}
