"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClasses, textareaClasses } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { createEventAction } from "@/features/events/actions";
import { Link } from "@/i18n/navigation";

/** Formats an instant the way `<input type="datetime-local">` expects. */
function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Event form. The default start is computed on the client (the member's own
 * timezone — Vercel's UTC clock would pick a surprising hour otherwise).
 */
export function EventForm() {
  const t = useTranslations("Events");
  const tAuth = useTranslations("Auth.errors");

  const [state, formAction] = useActionState(
    createEventAction,
    initialActionState,
  );
  const [defaultStart] = useState(() =>
    toLocalInput(new Date(Date.now() + 24 * 60 * 60 * 1000)),
  );

  const errorMessage =
    state.status === "error"
      ? state.code === "too_many_attempts"
        ? tAuth("too_many_attempts")
        : state.code === "not_authorised"
          ? tAuth("not_authorised")
          : state.code === "invalid_input"
            ? t("errors.invalid")
            : t("errors.failed")
      : null;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {errorMessage ? (
        <p
          role="alert"
          className="rounded-control bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {errorMessage}
        </p>
      ) : null}

      <Card className="flex flex-col gap-4 p-5">
        <Field htmlFor="title" label={t("name")}>
          <input
            id="title"
            name="title"
            type="text"
            required
            minLength={3}
            maxLength={120}
            placeholder={t("namePlaceholder")}
            className={inputClasses}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="starts_at" label={t("startsAt")}>
            <input
              id="starts_at"
              name="starts_at"
              type="datetime-local"
              required
              defaultValue={defaultStart}
              className={inputClasses}
            />
          </Field>

          <Field htmlFor="ends_at" label={t("endsAt")}>
            <input
              id="ends_at"
              name="ends_at"
              type="datetime-local"
              className={inputClasses}
            />
          </Field>
        </div>

        <Field htmlFor="location" label={t("location")}>
          <input
            id="location"
            name="location"
            type="text"
            maxLength={160}
            placeholder={t("locationPlaceholder")}
            className={inputClasses}
          />
        </Field>

        <Field htmlFor="description" label={t("descriptionLabel")}>
          <textarea
            id="description"
            name="description"
            maxLength={2000}
            rows={4}
            className={textareaClasses}
          />
        </Field>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/events"
          className={buttonClasses({ variant: "secondary" })}
        >
          {t("cancel")}
        </Link>
        <SubmitButton pendingLabel={t("publishing")}>
          {t("publish")}
        </SubmitButton>
      </div>
    </form>
  );
}
