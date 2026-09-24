"use client";

import { Check, Copy, Power } from "lucide-react";
import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, inputClasses } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/FormMessage";
import { SubmitButton } from "@/components/ui/SubmitButton";
import {
  createInviteCodeAction,
  setInviteCodeActiveAction,
} from "@/features/admin/actions";
import { initialActionState } from "@/features/auth/action-state";
import { actionMessage, fieldMessage } from "@/features/auth/form-messages";

export type InviteCodeRow = {
  id: string;
  code: string;
  label: string | null;
  uses: number;
  maxUses: number;
  expiresAt: string | null;
  isActive: boolean;
};

/** Create codes, watch how many uses are left, and switch a code off instantly. */
export function InviteCodeManager({ codes }: { codes: InviteCodeRow[] }) {
  const t = useTranslations("Admin");
  const tAuth = useTranslations("Auth");
  const [state, formAction] = useActionState(
    createInviteCodeAction,
    initialActionState,
  );
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const message = actionMessage(tAuth, state);

  async function copy(code: string, id: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // Clipboard access can be blocked; the code is visible either way.
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-3" noValidate>
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-[1.2fr_1.4fr_auto] sm:items-end">
          <Field
            htmlFor="code"
            label={t("codeLabel")}
            description={t("codeHint")}
            error={fieldMessage(tAuth, state, "code")}
          >
            <input
              id="code"
              name="code"
              required
              dir="ltr"
              spellCheck={false}
              placeholder="OUST-CS-2026"
              className={inputClasses}
            />
          </Field>

          <Field
            htmlFor="label"
            label={t("codeNote")}
            error={fieldMessage(tAuth, state, "label")}
          >
            <input
              id="label"
              name="label"
              type="text"
              className={inputClasses}
            />
          </Field>

          <Field
            htmlFor="max_uses"
            label={t("codeMaxUses")}
            error={fieldMessage(tAuth, state, "max_uses")}
          >
            <input
              id="max_uses"
              name="max_uses"
              type="number"
              min={1}
              max={500}
              defaultValue={1}
              className={inputClasses}
            />
          </Field>
        </div>

        <div>
          <SubmitButton pendingLabel={t("creating")}>
            {t("createCode")}
          </SubmitButton>
        </div>
      </form>

      {codes.length === 0 ? (
        <p className="rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {t("codesEmpty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {codes.map((code) => (
            <li
              key={code.id}
              className="flex flex-wrap items-center gap-2 py-3 text-sm"
            >
              <code
                dir="ltr"
                className="rounded-control bg-surface-2 px-2 py-1 font-mono text-[0.8125rem] text-text"
              >
                {code.code}
              </code>

              <Button
                size="sm"
                variant="ghost"
                aria-label={t("copy")}
                title={t("copy")}
                onClick={() => void copy(code.code, code.id)}
              >
                {copiedId === code.id ? (
                  <Check className="size-4" aria-hidden="true" />
                ) : (
                  <Copy className="size-4" aria-hidden="true" />
                )}
              </Button>

              {code.label ? (
                <span className="truncate text-muted">{code.label}</span>
              ) : null}

              <Chip
                tone={code.uses >= code.maxUses ? "accent" : "brand"}
                className="ms-auto"
              >
                {t("codeUses", { used: code.uses, total: code.maxUses })}
              </Chip>

              {!code.isActive ? <Chip>{t("codeInactive")}</Chip> : null}

              <Button
                size="sm"
                variant="ghost"
                disabled={isPending}
                onClick={() =>
                  startTransition(async () => {
                    await setInviteCodeActiveAction(code.id, !code.isActive);
                  })
                }
              >
                <Power className="size-4" aria-hidden="true" />
                {code.isActive ? t("deactivate") : t("activate")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
