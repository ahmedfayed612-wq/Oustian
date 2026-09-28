"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UsersRound } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { respondGroupInvitationAction } from "./actions";
import type { PresentationGroupInvitationRow } from "./queries";

/**
 * Pending presentation-group invitations. Accept/decline run through the
 * server action (row-locked capacity check), and the row disappears from the
 * list either way — a rejection racing another member past 10 simply returns
 * an error message the member sees inline.
 */
export function GroupInvitationList({
  initialInvitations,
  avatarUrls = {},
}: {
  initialInvitations: PresentationGroupInvitationRow[];
  /** Pre-signed storage URLs keyed by avatar_path. */
  avatarUrls?: Record<string, string>;
}) {
  const t = useTranslations("Groups");
  const [invitations, setInvitations] = useState(initialInvitations);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (invitations.length === 0) return null;

  async function respond(id: string, accept: boolean) {
    setBusyId(id);
    setError(null);

    const result = await respondGroupInvitationAction(id, accept);

    if (result.status === "error") {
      setError(result.error ?? null);
      setBusyId(null);
      return;
    }

    setInvitations((current) => current.filter((invite) => invite.id !== id));
    setBusyId(null);
  }

  return (
    <Card className="p-4">
      <h2 className="text-[0.9375rem] font-semibold text-text">
        {t("invitationsTitle")}
      </h2>

      {error ? (
        <p
          role="alert"
          className="mt-2 rounded-control bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      ) : null}

      <ul className="mt-3 flex flex-col gap-3">
        {invitations.map((invitation) => {
          const group = invitation.group;
          const title =
            group?.name ||
            group?.subject?.name_en ||
            t("subjectFallback");

          return (
            <li key={invitation.id} className="flex items-center gap-3">
              <Avatar
                size="sm"
                name={invitation.inviter?.full_name ?? "?"}
                src={
                  invitation.inviter?.avatar_path
                    ? (avatarUrls[invitation.inviter.avatar_path] ?? null)
                    : null
                }
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm text-text">
                  <span className="truncate font-semibold">
                    {invitation.inviter?.full_name ?? "—"}
                  </span>
                  <UsersRound className="size-3.5 shrink-0 text-muted" aria-hidden="true" />
                </span>
                <span className="mt-0.5 block truncate text-xs text-muted" dir="auto">
                  {title}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <Button
                  size="sm"
                  variant="primary"
                  isLoading={busyId === invitation.id}
                  onClick={() => respond(invitation.id, true)}
                >
                  {t("accept")}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  isLoading={busyId === invitation.id}
                  onClick={() => respond(invitation.id, false)}
                >
                  {t("decline")}
                </Button>
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
