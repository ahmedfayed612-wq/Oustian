"use client";

import { useActionState, useState } from "react";
import type { FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Field, inputClasses } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { signInAction } from "@/features/auth/actions";
import { actionMessage, fieldMessage } from "@/features/auth/form-messages";
import { emailSchema } from "@/features/auth/validation";

export function LoginForm() {
  const t = useTranslations("Auth");
  const [state, formAction] = useActionState(signInAction, initialActionState);
  // A malformed email is answered here, so the member sees why before spending
  // a round trip. Empty is left to the action: that is not a format problem.
  const [emailInvalid, setEmailInvalid] = useState(false);
  const message = actionMessage(t, state);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const email = String(new FormData(event.currentTarget).get("email") ?? "");
    const invalid =
      email.trim() !== "" && !emailSchema.safeParse(email).success;

    setEmailInvalid(invalid);

    if (invalid) event.preventDefault();
  }

  return (
    <Card className="p-5 sm:p-6">
      <h1 className="text-xl font-bold text-text">{t("login.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("login.subtitle")}</p>

      <form
        action={formAction}
        onSubmit={handleSubmit}
        className="mt-5 flex flex-col gap-4"
        noValidate
      >
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}

        <Field
          htmlFor="email"
          label={t("login.email")}
          error={
            emailInvalid ? t("fields.email") : fieldMessage(t, state, "email")
          }
        >
          <input
            id="email"
            name="email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            autoCapitalize="none"
            autoCorrect="off"
            placeholder="name@example.com"
            defaultValue={state.values?.email}
            onChange={() => setEmailInvalid(false)}
            aria-invalid={
              emailInvalid || state.fields?.includes("email") || undefined
            }
            className={inputClasses}
          />
        </Field>

        <Field
          htmlFor="password"
          label={t("login.password")}
          error={fieldMessage(t, state, "password")}
        >
          <input
            id="password"
            name="password"
            type="password"
            required
            dir="ltr"
            autoComplete="current-password"
            aria-invalid={state.fields?.includes("password") || undefined}
            className={inputClasses}
          />
        </Field>

        <SubmitButton className="w-full" pendingLabel={t("common.working")}>
          {t("login.submit")}
        </SubmitButton>
      </form>
    </Card>
  );
}
