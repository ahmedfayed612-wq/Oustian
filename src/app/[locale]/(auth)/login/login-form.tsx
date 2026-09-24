"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Field, inputClasses } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { signInAction } from "@/features/auth/actions";
import { actionMessage, fieldMessage } from "@/features/auth/form-messages";

export function LoginForm() {
  const t = useTranslations("Auth");
  const [state, formAction] = useActionState(signInAction, initialActionState);
  const message = actionMessage(t, state);

  return (
    <Card className="p-5 sm:p-6">
      <h1 className="text-xl font-bold text-text">{t("login.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("login.subtitle")}</p>

      <form action={formAction} className="mt-5 flex flex-col gap-4" noValidate>
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}

        <Field
          htmlFor="email"
          label={t("login.email")}
          error={fieldMessage(t, state, "email")}
        >
          <input
            id="email"
            name="email"
            type="email"
            required
            dir="ltr"
            autoComplete="email"
            placeholder="name@example.com"
            aria-invalid={state.fields?.includes("email") || undefined}
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
