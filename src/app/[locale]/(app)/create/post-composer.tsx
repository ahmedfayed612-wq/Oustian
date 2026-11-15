"use client";

import { useRef, useState } from "react";
import { useActionState } from "react";
import { Image as ImageIcon, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClasses } from "@/components/ui/Button";
import { initialActionState } from "@/features/auth/action-state";
import { createPostAction } from "@/features/feed/actions";
import { createMediaUploadTicketAction } from "@/features/media/actions";
import { processImage } from "@/features/media/image-process";
import { MAX_ALT_TEXT_LENGTH, MAX_IMAGE_BYTES } from "@/features/media/limits";
import { Link, useRouter } from "@/i18n/navigation";

const MAX_POST_LENGTH = 5000;

/**
 * The full-screen composer (`/create`). Publishing is a server action (the
 * single canonical publish path); everything else stays client for instant
 * feedback. On success the member lands back on the feed.
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

  const [state, formAction] = useActionState(createPostAction, initialActionState);
  const [body, setBody] = useState("");
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [mediaKey, setMediaKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [altText, setAltText] = useState("");
  const [uploading, setUploading] = useState(false);
  const [clientError, setClientError] = useState<string | null>(null);

  const canPublish = body.length > 0 || mediaKey !== null;
  function errorMessageFor(code: string | undefined): string | null {
    if (!code) return null;
    switch (code) {
      case "photoUnreadable":
        return t("photoUnreadable");
      case "photoWrongType":
        return t("photoWrongType");
      case "photoTooLarge":
        return t("photoTooLarge");
      case "post_failed":
        return "Post failed. Please try again.";
      case "too_many_attempts":
        return "Too many posts. Please wait a moment.";
      case "invalid_input":
        return "Please fix the highlighted fields.";
      case "post_required":
        return "Please write something or add a photo.";
      default:
        return code;
    }
  }


  useEffect(() => {
    if (state.status === "success") {
      router.push("/");
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };

  async function handleFileSelect(file: File) {
    setClientError(null);

    // Re-assert the pre-processing ceiling as a backstop against anything that
    // could still exceed it (compose limits are also enforced server-side).
    if (file.size > MAX_IMAGE_BYTES) {
      setClientError(t("photoTooLarge"));
      return;
    }

    setUploading(true);
    try {
      // Process into a full-resolution WebP (EXIF orientation applied, EXIF/GPS
      // stripped by the canvas re-encode). The returned `full` is uploaded so the
      // stored bytes are the authority; dimensions are re-checked on publish.
      const processed = await processImage(file);
      if (!processed.ok) {
        setClientError(t("photoUnreadable"));
        setUploading(false);
        return;
      }
      const { photo } = processed;

      const ticket = await createMediaUploadTicketAction("image/webp", "post");
      if (!ticket.ok) {
        setClientError(
          ticket.code === "photo_wrong_type" ? t("photoWrongType") : t("photoUnreadable"),
        );
        setUploading(false);
        return;
      }

      const supabase = createClient();
      const { error } = await supabase.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, photo.full, {
          contentType: "image/webp",
        });

      if (error) {
        console.error("[composer] upload failed", error.message);
        await supabase.storage.from(ticket.bucket).remove([ticket.path]);
        setClientError(t("photoUnreadable"));
      } else {
        setMediaKey(ticket.path);
        setMediaFiles((s) => [...s, photo.full]);
        setPreviewUrl(URL.createObjectURL(photo.full));
      }
    } catch {
      setClientError(t("photoUnreadable"));
    } finally {
      setUploading(false);
    }
  }

  function removeAttachedPhoto(index: number) {
    setMediaFiles((s) => s.filter((_, i) => i !== index));
    setMediaKey((k) => (k === mediaKey ? null : k));
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
  }


  return (
    <>
    <Card className="p-4 sm:p-5">
      {mediaKey ? (
        <div className="space-y-3">
          <div className="relative">
            <img
              src={previewUrl}
              alt={altText || t("photoPreview")}
              className="max-h-80 w-auto rounded-md object-contain"
            />
            <button
              type="button"
              onClick={() => removeAttachedPhoto(0)}
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
              onChange={(e) => setAltText(e.target.value.slice(0, MAX_ALT_TEXT_LENGTH))}
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

      {errorMessageFor(state.code) ? (
        <p role="alert" className="text-sm text-danger">
          {errorMessageFor(state.code)}
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
}


