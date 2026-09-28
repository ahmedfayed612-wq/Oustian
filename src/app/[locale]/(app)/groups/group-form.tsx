"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field, inputClasses, selectClasses, textareaClasses } from "@/components/ui/Field";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createPresentationGroupAction } from "@/features/groups/actions";
import {
  capInvitees,
  MAX_INITIAL_INVITEES,
  remainingSpots,
} from "@/features/groups/capacity";
import type { SubjectOption } from "@/features/groups/queries";
import type { MemberCard } from "@/features/connections/queries";
import { Link, useRouter } from "@/i18n/navigation";
import { facultyOptions } from "@/lib/profile-options";

type GroupFormState = {
  status: "idle" | "error" | "success";
  error?: string;
  groupId?: string;
};

const initialState: GroupFormState = { status: "idle" };

/**
 * Presentation-group create form. Subject is grouped by faculty; invitees are
 * multi-select connections capped at 9 (the owner takes spot 10 of the…
 * rather, 1 of 10) — the server re-validates the cap inside the transaction.
 */
export function GroupForm({
  subjects,
  connections,
}: {
  subjects: SubjectOption[];
  connections: MemberCard[];
}) {
  const t = useTranslations("Groups");
  const locale = useLocale();
  const router = useRouter();
  const [state, formAction] = useActionState(
    createPresentationGroupAction as (
      prev: unknown,
      data: FormData,
    ) => Promise<GroupFormState>,
    initialState,
  );
  const [invitees, setInvitees] = useState<string[]>([]);

  const byFaculty = useMemo(() => {
    const groups = new Map<string, SubjectOption[]>();
    for (const subject of subjects) {
      const list = groups.get(subject.faculty) ?? [];
      list.push(subject);
      groups.set(subject.faculty, list);
    }
    return groups;
  }, [subjects]);

  const facultyOrder = useMemo(
    () =>
      facultyOptions
        .map((option) => option.value)
        .filter((value) => byFaculty.has(value)),
    [byFaculty],
  );

  function toggleInvitee(id: string) {
    // memberCount 1 (the owner being created) → 9 open invitee spots.
    setInvitees((current) => capInvitees(current, id, 1));
  }

  // Server redirect would also work, but a client navigation keeps the create
  // button's pending state until the new screen is up.
  useEffect(() => {
    if (state.status === "success" && state.groupId) {
      router.push(`/groups/${state.groupId}`);
    }
  }, [state, router]);

  const spotsLeft = remainingSpots(1) - invitees.length;

  return (
    <form action={formAction} className="flex flex-col gap-3" noValidate>
      {state.status === "error" && state.error ? (
        <p
          role="alert"
          className="rounded-control bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Card className="flex flex-col gap-4 p-5">
        <Field htmlFor="subject_id" label={t("subjectLabel")}>
          <select
            id="subject_id"
            name="subject_id"
            required
            className={selectClasses}
            defaultValue=""
          >
            <option value="" disabled>
              {t("subjectPlaceholder")}
            </option>
            {facultyOrder.map((faculty) => {
              const facultyLabel = facultyOptions.find(
                (option) => option.value === faculty,
              );
              return (
                <optgroup
                  key={faculty}
                  label={
                    facultyLabel
                      ? locale === "ar"
                        ? facultyLabel.nameAr
                        : facultyLabel.nameEn
                      : faculty
                  }
                >
                  {(byFaculty.get(faculty) ?? []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.code} — {subject.name_en}
                    </option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </Field>

        <Field htmlFor="name" label={t("nameLabel")}>
          <input
            id="name"
            name="name"
            type="text"
            maxLength={100}
            placeholder={t("namePlaceholder")}
            className={inputClasses}
          />
        </Field>

        <Field htmlFor="description" label={t("descriptionLabel")}>
          <textarea
            id="description"
            name="description"
            rows={3}
            maxLength={500}
            placeholder={t("descriptionPlaceholder")}
            className={textareaClasses}
          />
        </Field>

        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-semibold text-text">
            {t("inviteesLabel")}
          </legend>
          <p className="text-xs text-muted">
            {t("inviteesHint", { count: MAX_INITIAL_INVITEES })}
          </p>

          {connections.length === 0 ? (
            <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted">
              {t("inviteesEmpty")}
            </p>
          ) : (
            <ul className="flex max-h-56 flex-col gap-1 overflow-y-auto rounded-control border border-border p-1">
              {connections.map((person) => {
                const checked = invitees.includes(person.id);
                const disabled = !checked && invitees.length >= MAX_INITIAL_INVITEES;
                return (
                  <li key={person.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-control px-2 py-1.5 hover:bg-surface-2">
                      <input
                        type="checkbox"
                        name="invitees"
                        value={person.id}
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleInvitee(person.id)}
                        className="size-4 shrink-0 accent-[var(--brand,#0e7c86)]"
                      />
                      <span className="min-w-0 truncate text-sm text-text">
                        {person.full_name}
                        <span className="ms-1.5 text-muted" dir="ltr">
                          @{person.username}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}

          {invitees.length > 0 ? (
            <p className="text-xs text-muted">
              {t("inviteesHint", { count: MAX_INITIAL_INVITEES })} · {spotsLeft}
            </p>
          ) : null}
        </fieldset>
      </Card>

      <div className="flex items-center justify-end gap-2">
        <Link
          href="/groups"
          className={buttonClasses({ variant: "secondary" })}
        >
          {t("backToGroups")}
        </Link>
        <SubmitButton pendingLabel={t("create")}>{t("create")}</SubmitButton>
      </div>
    </form>
  );
}
