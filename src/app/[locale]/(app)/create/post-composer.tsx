"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { createPostAction } from "@/features/feed/actions";
import { Link, useRouter } from "@/i18n/navigation";

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

  const [state, formAction] = useActionState(
    createPostAction,
    initialActionState,
  );
  const [body, setBody] = useState("");

  useEffect(() => {
    if (state.status === "success") {
      router.push("/");
      router.refresh();
    }
  }, [state, router]);

  const errorMessage =
    state.status === "error"
      ? state.code === "too_many_attempts"
        ? tAuth("too_many_attempts")
        : state.code === "invalid_input"
          ? t("empty")
          : t("failed")
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      <Card className="flex gap-3 p-4">
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
            rows={6}
            maxLength={MAX_POST_LENGTH}
            className="w-full resize-y rounded-control border border-border bg-surface-2 px-3.5 py-3 text-[0.9375rem] leading-relaxed text-text placeholder:text-muted focus:border-brand focus:outline-none"
          />

          <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
            <span>{t("hint")}</span>
            <span className="shrink-0 tabular-nums">
              {t("counter", { count: body.length })}
            </span>
          </div>

          {errorMessage ? (
            <p role="alert" className="mt-2 text-sm text-danger">
              {errorMessage}
            </p>
          ) : null}
        </div>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link href="/" className={buttonClasses({ variant: "secondary" })}>
          {t("cancel")}
        </Link>
        <SubmitButton pendingLabel={t("publishing")} disabled={!body.trim()}>
          {t("publish")}
        </SubmitButton>
      </div>
    </form>
  );
}
