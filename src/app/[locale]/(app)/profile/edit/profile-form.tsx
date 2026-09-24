"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@/components/ui/Card";
import {
  Field,
  inputClasses,
  selectClasses,
  textareaClasses,
} from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialActionState } from "@/features/auth/action-state";
import { updateProfileAction } from "@/features/auth/actions";
import { actionMessage, fieldMessage } from "@/features/auth/form-messages";
import { facultyOptions, graduationYearOptions } from "@/lib/profile-options";
import { AvatarUploader } from "./avatar-uploader";

export type ProfileFormValues = {
  fullName: string;
  bio: string;
  faculty: string;
  graduationYear: string;
  language: "ar" | "en";
  username: string;
  avatarPath: string | null;
};

/**
 * Profile editor. Username is shown but read-only here — changing handles is a
 * separate decision (and the trigger keeps `status`/`role` untouchable anyway,
 * so this form can never escalate anything).
 */
export function ProfileForm({
  profile,
  avatarUrl,
}: {
  profile: ProfileFormValues;
  avatarUrl: string | null;
}) {
  const t = useTranslations("Profile");
  const tAuth = useTranslations("Auth");
  const locale = useLocale();
  const [state, formAction] = useActionState(
    updateProfileAction,
    initialActionState,
  );
  const message = actionMessage(tAuth, state);
  const years = graduationYearOptions();

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {message ? (
        <FormMessage tone={message.tone}>{message.text}</FormMessage>
      ) : null}

      <Card className="flex flex-col gap-4 p-5">
        <AvatarUploader name={profile.fullName} avatarUrl={avatarUrl} />

        <Field
          htmlFor="full_name"
          label={t("fullName")}
          error={fieldMessage(tAuth, state, "full_name")}
        >
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            defaultValue={profile.fullName}
            autoComplete="name"
            className={inputClasses}
          />
        </Field>

        <Field
          htmlFor="username"
          label={t("username")}
          description={t("usernameLocked")}
        >
          <input
            id="username"
            type="text"
            value={profile.username}
            readOnly
            disabled
            dir="ltr"
            className={inputClasses}
          />
        </Field>

        <Field
          htmlFor="bio"
          label={t("bio")}
          description={t("bioHint")}
          error={fieldMessage(tAuth, state, "bio")}
        >
          <textarea
            id="bio"
            name="bio"
            maxLength={280}
            defaultValue={profile.bio}
            className={textareaClasses}
          />
        </Field>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field htmlFor="faculty" label={t("faculty")}>
            <select
              id="faculty"
              name="faculty"
              defaultValue={profile.faculty}
              className={selectClasses}
            >
              <option value="">{t("facultyPlaceholder")}</option>
              {facultyOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {locale === "ar" ? option.nameAr : option.nameEn}
                </option>
              ))}
            </select>
          </Field>

          <Field htmlFor="graduation_year" label={t("graduationYear")}>
            <select
              id="graduation_year"
              name="graduation_year"
              defaultValue={profile.graduationYear}
              className={selectClasses}
            >
              <option value="">{t("graduationYearPlaceholder")}</option>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field
          htmlFor="language"
          label={t("languageLabel")}
          description={t("languageHint")}
        >
          <select
            id="language"
            name="language"
            defaultValue={profile.language}
            className={selectClasses}
          >
            <option value="en">{t("language.en")}</option>
            <option value="ar">{t("language.ar")}</option>
          </select>
        </Field>

        <SubmitButton pendingLabel={t("saving")}>{t("save")}</SubmitButton>
      </Card>
    </form>
  );
}
