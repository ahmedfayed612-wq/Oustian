"use client";

import { Check, X } from "lucide-react";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { FormMessage } from "@/components/ui/FormMessage";
import { Field, inputClasses } from "@/components/ui/Field";
import {
  approveMemberAction,
  rejectMemberAction,
} from "@/features/admin/actions";

export type PendingMember = {
  id: string;
  fullName: string;
  username: string;
  detail: string;
  verification: string;
  requestedAt: string;
};

/**
 * Approval queue. Rows leave the list once a decision sticks, and the reject
 * path asks for a reason that the member then sees on the holding screen.
 */
export function ApprovalQueue({ members }: { members: PendingMember[] }) {
  const t = useTranslations("Admin");
  const tAuth = useTranslations("Auth");
  const tSuccess = useTranslations("Auth.success");
  const [resolved, setResolved] = useState<string[]>([]);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState<{
    tone: "error" | "success";
    text: string;
  } | null>(null);
  const [isPending, startTransition] = useTransition();

  const visible = members.filter((member) => !resolved.includes(member.id));

  function decide(member: PendingMember, approve: boolean) {
    setMessage(null);

    startTransition(async () => {
      const result = approve
        ? await approveMemberAction(member.id)
        : await rejectMemberAction(member.id, reason);

      if (result.status === "error") {
        const key = `errors.${result.code}`;
        setMessage({
          tone: "error",
          text: tAuth.has(key) ? tAuth(key) : tAuth("errors.unknown"),
        });
        return;
      }

      setResolved((previous) => [...previous, member.id]);
      setRejectingId(null);
      setReason("");

      const code = result.code ?? "unknown";
      setMessage({
        tone: "success",
        text: tSuccess.has(code)
          ? tSuccess(code, { name: member.fullName })
          : member.fullName,
      });
    });
  }

  if (visible.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        {message ? (
          <FormMessage tone={message.tone}>{message.text}</FormMessage>
        ) : null}
        <p className="rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-muted">
          {t("queueEmpty")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <FormMessage tone={message.tone}>{message.text}</FormMessage>
      ) : null}

      <ul className="flex flex-col divide-y divide-border">
        {visible.map((member) => (
          <li key={member.id} className="flex flex-col gap-3 py-3">
            <div className="flex items-center gap-3">
              <Avatar size="md" name={member.fullName} />

              <div className="min-w-0 flex-1">
                <p className="truncate text-[0.9375rem] font-semibold text-text">
                  {member.fullName}
                </p>
                <p className="truncate text-xs text-muted" dir="ltr">
                  @{member.username}
                </p>
                {member.detail ? (
                  <p className="truncate text-xs text-muted">{member.detail}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="primary"
                  disabled={isPending}
                  onClick={() => decide(member, true)}
                >
                  <Check className="size-4" aria-hidden="true" />
                  {t("approve")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={isPending}
                  onClick={() => {
                    setMessage(null);
                    setRejectingId(
                      rejectingId === member.id ? null : member.id,
                    );
                  }}
                >
                  <X className="size-4" aria-hidden="true" />
                  {t("reject")}
                </Button>
              </div>
            </div>

            {rejectingId === member.id ? (
              <div className="flex flex-col gap-2 rounded-control bg-surface-2 p-3 sm:flex-row sm:items-end">
                <Field
                  htmlFor={`reason-${member.id}`}
                  label={t("rejectReason")}
                  className="flex-1"
                >
                  <input
                    id={`reason-${member.id}`}
                    value={reason}
                    maxLength={280}
                    onChange={(event) => setReason(event.target.value)}
                    placeholder={t("rejectReasonPlaceholder")}
                    className={inputClasses}
                  />
                </Field>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={isPending}
                  onClick={() => decide(member, false)}
                >
                  {t("rejectConfirm")}
                </Button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
