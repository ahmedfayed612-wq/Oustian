"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { createMediaUploadTicketAction } from "@/features/media/actions";
import {
  kindForFile,
  maxBytesForKind,
  measureImage,
  measureVideo,
  reEncodeImageToJpeg,
  shouldReEncode,
} from "@/features/media/client-media";
import {
  MAX_STORY_CAPTION_LENGTH,
  MIN_IMAGE_DIMENSION,
  STORY_ACCEPT_ATTRIBUTE,
  STORY_TTL_HOURS,
  type StoryMediaKind,
} from "@/features/media/limits";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { createStoryAction } from "./actions";

/**
 * Every failure the composer can report, keyed into `Stories.composer.*`.
 * Codes rather than messages on purpose: the wording is resolved at render, so
 * a locale switch mid-upload does not leave a stale string on screen.
 */
type ComposerError =
  | "mediaRequired"
  | "unsupportedType"
  | "photoTooLarge"
  | "videoTooLarge"
  | "tooSmall"
  | "unreadable"
  | "uploadFailed"
  | "tooManyAttempts"
  | "failed";

/** The media attached to the story, as the server stored it. */
type AttachedMedia = {
  /** Storage path minted by the ticket action — the publish payload. */
  key: string;
  /** Local `blob:` preview of the exact bytes that were uploaded. */
  previewUrl: string;
  kind: StoryMediaKind;
  width: number;
  height: number;
};

/**
 * Story composer: Add story → pick a photo or video → preview → publish.
 *
 * The plumbing mirrors the post composer deliberately (ticket → direct upload →
 * server-side byte sniffing, blob preview, pending/retry states) so there is one
 * upload behaviour to reason about. What differs is the canvas: a story is one
 * piece of media, so the preview adopts the media's own aspect ratio instead of
 * cropping to a fixed frame, and a clip is measured by the browser (which
 * applies the rotation matrix) before it is uploaded.
 *
 * Three failure modes are handled explicitly because they are the ones members
 * hit on a phone: a file type we cannot store (reported, never uploaded), an
 * upload that fails in transit (its own message, logged for debugging), and a
 * retry with the same file — the input is cleared on every path, so picking the
 * same photo twice always fires `change` again.
 */
export function StoryComposer() {
  const t = useTranslations("Stories");
  const tAuth = useTranslations("Auth.errors");
  const router = useRouter();

  const fileInputRef = useRef<HTMLInputElement>(null);
  // Preview URLs are revoked through a ref so replacing media, removing it and
  // unmounting all revoke exactly once (the old blob: URL, never the new one).
  const previewUrlRef = useRef<string | null>(null);

  const [state, formAction] = useActionState(
    createStoryAction,
    initialActionState,
  );

  const [attached, setAttached] = useState<AttachedMedia | null>(null);
  const [caption, setCaption] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<ComposerError | null>(null);

  const busy = preparing || uploading;

  function releasePreview() {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = null;
  }

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function detach() {
    releasePreview();
    setAttached(null);
    resetFileInput();
  }

  function removeMedia() {
    detach();
    setError(null);
  }

  /**
   * A rejected publish is always a rejected *upload*: the action deletes the
   * object when its bytes fail the policy, so the attachment is dropped the
   * moment the failure arrives — otherwise the member could only ever resubmit
   * a key whose object no longer exists.
   *
   * Adjusted **during render** (React's "state derived from a previous render"
   * pattern) rather than in an effect: React discards this render's output and
   * re-runs it before painting, so the stale preview is never shown, and no
   * effect has to poke state after the commit. `handledErrorFor` records which
   * failure was already applied so a later selection is not thrown away by the
   * same one.
   */
  const [handledErrorFor, setHandledErrorFor] = useState<typeof state | null>(
    null,
  );

  if (state.status === "error" && attached && state !== handledErrorFor) {
    setHandledErrorFor(state);
    // The blob URL is revoked by the next `releasePreview()` (a replacement or
    // the unmount cleanup) — one owner, one revocation.
    setAttached(null);
  }

  useEffect(() => {
    if (state.status === "success") {
      router.push("/");
      router.refresh();
    }
  }, [state, router]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  /**
   * Validates and uploads one picked file. Nothing is sent to Storage until the
   * browser has proved it can read the file and that it clears the policy — so
   * an unsupported file costs one local decode, not a failed round trip.
   */
  async function handleFileSelect(file: File) {
    // A second pick while an upload is in flight is ignored: one upload, one
    // story, no interleaved previews.
    if (busy) return;

    setError(null);

    let kind = kindForFile(file);

    if (file.size > maxBytesForKind(kind)) {
      setError(kind === "video" ? "videoTooLarge" : "photoTooLarge");
      resetFileInput();
      return;
    }

    setPreparing(true);

    try {
      // Formats we do not store but the browser can paint (HEIC from a phone
      // camera, an untyped file) are re-encoded to JPEG before upload; anything
      // the browser cannot read is refused here with an honest message.
      let upload = file;

      if (shouldReEncode(file)) {
        const reEncoded = await reEncodeImageToJpeg(file);

        if (!reEncoded) {
          setError("unsupportedType");
          return;
        }

        upload = reEncoded;
        kind = "image";
      }

      const dimensions =
        kind === "video" ? await measureVideo(upload) : await measureImage(upload);

      if (!dimensions) {
        setError("unreadable");
        return;
      }

      if (
        dimensions.width < MIN_IMAGE_DIMENSION ||
        dimensions.height < MIN_IMAGE_DIMENSION
      ) {
        setError("tooSmall");
        return;
      }

      // From here the bytes leave the device. Types that need no re-encode are
      // uploaded exactly as the picker handed them over.
      setPreparing(false);
      setUploading(true);

      const ticket = await createMediaUploadTicketAction(upload.type, "story");

      if (!ticket.ok) {
        console.error("[story-composer] upload ticket refused", ticket.code);
        setError(
          ticket.code === "photo_wrong_type" ? "unsupportedType" : "uploadFailed",
        );
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, upload, {
          contentType: upload.type,
        });

      if (uploadError) {
        // Transport-level failure (network, bucket policy, CORS): logged in
        // full for debugging, reported as a retryable error — never as a
        // "we couldn't read your file", which would send the member hunting
        // for a problem with their photo.
        console.error("[story-composer] upload failed", uploadError.message);
        setError("uploadFailed");
        return;
      }

      releasePreview();

      const objectUrl = URL.createObjectURL(upload);
      previewUrlRef.current = objectUrl;

      setAttached({
        key: ticket.path,
        previewUrl: objectUrl,
        kind,
        width: dimensions.width,
        height: dimensions.height,
      });
    } catch (caught) {
      console.error("[story-composer] media upload error", caught);
      setError("uploadFailed");
    } finally {
      setPreparing(false);
      setUploading(false);
      // Always clear the input: re-picking the *same* file must fire `change`
      // again (a failed upload followed by a silent no-op is the worst state a
      // composer can leave a member in).
      resetFileInput();
    }
  }

  const errorMessage = resolveErrorMessage({
    error,
    kind: attached?.kind ?? "image",
    stateCode: state.status === "error" ? state.code : undefined,
    t,
    tAuth,
  });

  const canPublish = Boolean(attached) && !busy;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <input type="hidden" name="mediaKey" value={attached?.key ?? ""} />
      <input type="hidden" name="caption" value={caption} />
      <input type="hidden" name="mediaWidth" value={attached?.width ?? ""} />
      <input type="hidden" name="mediaHeight" value={attached?.height ?? ""} />

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm text-muted">
          {t("composer.visibilityNote")}{" "}
          {t("composer.ttlNote", { hours: STORY_TTL_HOURS })}
        </p>

        {attached ? (
          <div className="flex flex-col gap-2">
            <MediaPreview media={attached} removeLabel={t("composer.removeMedia")} onRemove={removeMedia} />

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
                className="w-full min-w-0 rounded-control border border-border bg-surface px-3 py-2 text-sm text-text placeholder:text-muted focus:border-brand focus:outline-none"
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
            disabled={busy}
            className="flex flex-col items-center gap-2 rounded-control border border-dashed border-border bg-surface-2/60 px-6 py-10 text-center transition-colors hover:border-border-strong disabled:opacity-60"
          >
            <span className="flex size-11 items-center justify-center rounded-pill bg-brand-soft text-brand">
              <ImagePlus className="size-5" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold text-text">
              {t("composer.pickMedia")}
            </span>
            <span className="text-xs text-muted">{t("composer.pickHint")}</span>
          </button>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept={STORY_ACCEPT_ATTRIBUTE}
          className="hidden"
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void handleFileSelect(file);
            else resetFileInput();
          }}
        />

        {preparing || uploading ? (
          <p className="flex items-center gap-2 text-xs text-muted" role="status">
            <Loader2 className="size-4 animate-spin text-brand" aria-hidden="true" />
            {preparing ? t("composer.preparing") : t("composer.uploading")}
          </p>
        ) : null}

        {attached ? (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={busy}
            className="self-start rounded-pill px-3 py-1.5 text-xs font-semibold text-muted transition hover:bg-surface-2 hover:text-text focus-visible:outline-2 focus-visible:outline-brand"
          >
            {t("composer.replaceMedia")}
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

/**
 * The attached media, as itself: a clip gets real player controls (so it can be
 * paused, which a tap-to-navigate story view must not swallow) and both kinds
 * keep their own aspect ratio inside a bounded frame.
 */
function MediaPreview({
  media,
  removeLabel,
  onRemove,
}: {
  media: AttachedMedia;
  removeLabel: string;
  onRemove: () => void;
}) {
  return (
    <div
      className="relative mx-auto flex max-h-[28rem] w-full items-center justify-center overflow-hidden rounded-control bg-surface-2"
      style={{
        aspectRatio: `${media.width} / ${media.height}`,
        maxWidth: "100%",
      }}
    >
      {media.kind === "video" ? (
        <video
          src={media.previewUrl}
          controls
          playsInline
          muted
          className="max-h-full max-w-full object-contain"
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={media.previewUrl}
          alt=""
          className="max-h-full max-w-full object-contain"
        />
      )}

      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        className="absolute top-2 end-2 flex size-8 items-center justify-center rounded-pill bg-black/60 text-white transition hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-brand"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * One message at a time, most specific first: a local error the member can act
 * on now, then the server's own verdict, and finally the generic retry.
 */
function resolveErrorMessage({
  error,
  kind,
  stateCode,
  t,
  tAuth,
}: {
  error: ComposerError | null;
  kind: StoryMediaKind;
  stateCode: string | undefined;
  t: ReturnType<typeof useTranslations<"Stories">>;
  tAuth: ReturnType<typeof useTranslations<"Auth.errors">>;
}): string | null {
  const code = error ?? mapServerCode(stateCode, kind);

  if (!code) return null;
  if (code === "tooManyAttempts") return tAuth("too_many_attempts");

  return t(`composer.${code}`);
}

/** The publish action's codes, in the composer's own vocabulary. */
function mapServerCode(
  stateCode: string | undefined,
  kind: StoryMediaKind,
): ComposerError | null {
  switch (stateCode) {
    case "invalid_input":
      return "mediaRequired";
    case "photo_wrong_type":
      return "unsupportedType";
    case "photo_too_large":
      return kind === "video" ? "videoTooLarge" : "photoTooLarge";
    case "photo_too_small":
      return "tooSmall";
    case "photo_unreadable":
      return "unreadable";
    case "too_many_attempts":
      return "tooManyAttempts";
    case undefined:
    case "idle":
    case "success":
      return null;
    default:
      return "failed";
  }
}
