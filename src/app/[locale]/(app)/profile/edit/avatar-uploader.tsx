"use client";

import { Upload, UserRoundX } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import {
  createAvatarUploadTicketAction,
  removeAvatarAction,
  setAvatarPathAction,
} from "@/features/auth/avatar-actions";
import { useRouter } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

/** Matches the bucket's own limit; failing early gives a better message. */
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Avatar upload, the serverless-safe way:
 *
 *   1. a server action checks the session and mints a signed upload URL,
 *   2. the browser PUTs the file straight to Supabase Storage,
 *   3. a second action records the path on the profile.
 *
 * The image never travels through a Next.js request body, which is what keeps a
 * 5 MB photo safely inside Vercel's ~4.5 MB function limit.
 */
export function AvatarUploader({
  name,
  avatarUrl,
}: {
  name: string;
  avatarUrl: string | null;
}) {
  const t = useTranslations("Profile.avatar");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(avatarUrl);

  async function handleFile(file: File) {
    setError(null);

    if (file.size > MAX_BYTES) {
      setError(t("tooLarge"));
      return;
    }

    const extension = (file.name.split(".").pop() ?? "").toLowerCase();

    setBusy(true);

    try {
      const ticket = await createAvatarUploadTicketAction(extension);

      if (!ticket.ok) {
        const key = `errors.${ticket.code}`;
        setError(t.has(key) ? t(key) : t("failed"));
        return;
      }

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from(ticket.bucket)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type,
        });

      if (uploadError) {
        console.error("[avatar] upload failed", uploadError.message);
        setError(t("failed"));
        return;
      }

      const saved = await setAvatarPathAction(ticket.path);

      if (saved.status === "error") {
        setError(t("failed"));
        return;
      }

      setPreview(URL.createObjectURL(file));
      router.refresh();
    } catch (uploadFailure) {
      console.error("[avatar] unexpected failure", uploadFailure);
      setError(t("failed"));
    } finally {
      setBusy(false);

      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function handleRemove() {
    setError(null);
    setBusy(true);

    try {
      const result = await removeAvatarAction();

      if (result.status === "error") {
        setError(t("failed"));
        return;
      }

      setPreview(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <Avatar size="xl" name={name} src={preview} ring />

        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            id="avatar"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />

          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={busy}
            loadingLabel={t("uploading")}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="size-4" aria-hidden="true" />
            {preview ? t("replace") : t("upload")}
          </Button>

          {preview ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() => void handleRemove()}
            >
              <UserRoundX className="size-4" aria-hidden="true" />
              {t("remove")}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-muted">{t("hint")}</p>

      {error ? <FormMessage tone="error">{error}</FormMessage> : null}
    </div>
  );
}
