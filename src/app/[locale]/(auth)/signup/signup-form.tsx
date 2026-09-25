"use client";

import { useActionState, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import { Field, inputClasses, selectClasses } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { checkInviteCodeAction, signUpAction } from "@/features/auth/actions";
import { actionMessage } from "@/features/auth/form-messages";
import {
  formDataToObject,
  invalidFields,
  signUpSchema,
} from "@/features/auth/validation";

type Option = { value: string; label: string };

type InviteState = {
  state: "idle" | "checking" | "valid" | "invalid";
  code?: string;
};

/**
 * Invite-gated sign-up.
 *
 * The invite code is checked against the database as soon as the field loses
 * focus (`checkInviteCodeAction`, read-only and rate-limited), so a bad code is
 * caught before an account is attempted. The authoritative check still happens
 * inside the signup trigger, in the same transaction as the auth user.
 */
export function SignUpForm({
  faculties,
  years,
}: {
  faculties: Option[];
  years: number[];
}) {
  const t = useTranslations("Auth");
  const [state, formAction] = useActionState(signUpAction, initialActionState);
  const [invite, setInvite] = useState<InviteState>({ state: "idle" });
  // Fields the browser rejected, and fields edited since the last reply: the
  // two together keep a stale message from outliving the value it was about.
  const [clientFields, setClientFields] = useState<string[]>([]);
  const [dirtyFields, setDirtyFields] = useState<string[]>([]);
  const message = actionMessage(t, state);

  async function verifyInviteCode(value: string) {
    const code = value.trim();

    if (!code) {
      setInvite({ state: "idle" });
      return;
    }

    setInvite({ state: "checking" });

    const result = await checkInviteCodeAction(code);

    setInvite(
      result.valid
        ? { state: "valid" }
        : { state: "invalid", code: result.code },
    );
  }

  const inviteText =
    invite.state === "valid"
      ? t("signup.inviteValid")
      : invite.state === "invalid"
        ? t.has(`errors.${invite.code}`)
          ? t(`errors.${invite.code}`)
          : t("errors.invite_code_invalid")
        : invite.state === "checking"
          ? t("common.working")
          : t("signup.inviteHint");

  /** Whether a field should show a message, from either validator. */
  function flagged(name: string) {
    return (
      clientFields.includes(name) ||
      (state.fields?.includes(name) === true && !dirtyFields.includes(name))
    );
  }

  function fieldError(name: string) {
    if (!flagged(name)) return undefined;

    const key = `fields.${name}`;

    return t.has(key) ? t(key) : t("errors.invalid_input");
  }

  /**
   * The action validates the same schema, but running it here first answers a
   * mistyped username or email instantly — and without the round trip that
   * resets the form. React clears every input once a form action finishes,
   * error return included, so a server-side rejection used to hand the member
   * an empty form with two red errors under it.
   */
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setDirtyFields([]);

    const parsed = signUpSchema.safeParse(
      formDataToObject(new FormData(event.currentTarget)),
    );

    if (parsed.success) {
      setClientFields([]);
      return;
    }

    event.preventDefault();
    setClientFields(invalidFields(parsed.error));
  }

  /** Editing a field clears its message, so a fixed value stops looking wrong. */
  function handleFieldEdit(event: ChangeEvent<HTMLFormElement>) {
    // The event bubbles up from the control that changed, so its `name` is the
    // field to forgive — read through `Element` because the form's own type
    // describes `target` as the form.
    const name = (event.target as Element).getAttribute("name") ?? "";

    if (name === "") return;

    setClientFields((fields) => fields.filter((field) => field !== name));
    setDirtyFields((fields) =>
      fields.includes(name) ? fields : [...fields, name],
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <h1 className="text-xl font-bold text-text">{t("signup.title")}</h1>
      <p className="mt-1 text-sm text-muted">{t("signup.subtitle")}</p>

      <form
        action={formAction}
        onSubmit={handleSubmit}
        onChange={handleFieldEdit}
        className="mt-5 flex flex-col gap-4"
        noValidate
      >
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}

        <Field
          htmlFor="invite_code"
          label={t("signup.inviteCode")}
          description={t("signup.inviteDescription")}
          hint={
            invite.state === "invalid" || invite.state === "valid"
              ? undefined
              : inviteText
          }
          error={
            fieldError("invite_code") ??
            (invite.state === "invalid" ? inviteText : undefined)
          }
        >
          <input
            id="invite_code"
            name="invite_code"
            type="text"
            required
            dir="ltr"
            autoComplete="off"
            spellCheck={false}
            placeholder="OUST-FOUNDERS-2026"
            defaultValue={state.values?.invite_code}
            aria-invalid={
              flagged("invite_code") || invite.state === "invalid" || undefined
            }
            className={inputClasses}
            onBlur={(event) => void verifyInviteCode(event.target.value)}
          />
        </Field>

        {invite.state === "valid" ? (
          <FormMessage tone="success">{inviteText}</FormMessage>
        ) : null}

        <Field
          htmlFor="full_name"
          label={t("signup.fullName")}
          error={fieldError("full_name")}
        >
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            autoComplete="name"
            defaultValue={state.values?.full_name}
            aria-invalid={flagged("full_name") || undefined}
            className={inputClasses}
          />
        </Field>

        <Field
          htmlFor="username"
          label={t("signup.username")}
          description={t("signup.usernameHint")}
          error={fieldError("username")}
        >
          <input
            id="username"
            name="username"
            type="text"
            required
            dir="ltr"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={24}
            defaultValue={state.values?.username}
            aria-invalid={flagged("username") || undefined}
            className={inputClasses}
          />
        </Field>

        <Field
          htmlFor="email"
          label={t("signup.email")}
          error={fieldError("email")}
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
            defaultValue={state.values?.email}
            aria-invalid={flagged("email") || undefined}
            className={inputClasses}
          />
        </Field>

        <Field
          htmlFor="password"
          label={t("signup.password")}
          description={t("signup.passwordHint")}
          error={fieldError("password")}
        >
          <input
            id="password"
            name="password"
            type="password"
            required
            dir="ltr"
            autoComplete="new-password"
            aria-invalid={flagged("password") || undefined}
            className={inputClasses}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="faculty" label={t("signup.faculty")}>
            <select
              id="faculty"
              name="faculty"
              defaultValue={state.values?.faculty ?? ""}
              className={selectClasses}
            >
              <option value="">{t("signup.facultyPlaceholder")}</option>
              {faculties.map((faculty) => (
                <option key={faculty.value} value={faculty.value}>
                  {faculty.label}
                </option>
              ))}
            </select>
          </Field>

          <Field htmlFor="graduation_year" label={t("signup.graduationYear")}>
            <select
              id="graduation_year"
              name="graduation_year"
              defaultValue={state.values?.graduation_year ?? ""}
              className={selectClasses}
            >
              <option value="">{t("signup.graduationYearPlaceholder")}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <SubmitButton className="w-full" pendingLabel={t("common.working")}>
          {t("signup.submit")}
        </SubmitButton>

        <p className="text-xs leading-relaxed text-muted">
          {t("signup.approvalNote")}
        </p>
      </form>
    </Card>
  );
}
