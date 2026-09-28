"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Field, selectClasses } from "@/components/ui/Field";
import {
  assignUserRoleAction,
  setRoleVerificationAction,
} from "@/features/roles/actions";
import type {
  AdminRoleAssignmentRow,
  UniversityRoleRow,
} from "@/features/roles/queries";

export type RoleStatus = AdminRoleAssignmentRow["verification_status"];

type MemberOption = { id: string; fullName: string; username: string };

const statusTone: Record<RoleStatus, "neutral" | "brand" | "accent"> = {
  pending: "neutral",
  verified: "brand",
  rejected: "accent",
  revoked: "accent",
  expired: "neutral",
};

/**
 * Admin university-role badge management: an assign form plus the full
 * assignment table with verify / reject / revoke. Every transition runs
 * through the RPC (or the audited insert) which appends to
 * `user_role_audit_logs` — this UI never writes status columns directly.
 */
export function RoleBadgeManager({
  assignments,
  roles,
  members,
}: {
  assignments: AdminRoleAssignmentRow[];
  roles: UniversityRoleRow[];
  members: MemberOption[];
}) {
  const t = useTranslations("AdminRoles");
  const [rows, setRows] = useState(assignments);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [assignUserId, setAssignUserId] = useState("");
  const [assignRoleId, setAssignRoleId] = useState("");
  const [assigning, setAssigning] = useState(false);

  async function assign(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!assignUserId || !assignRoleId || assigning) return;

    setAssigning(true);
    setError(null);
    setMessage(null);

    const result = await assignUserRoleAction(assignUserId, assignRoleId, true);

    if (result.status === "error") {
      setError(result.error ?? t("failed"));
    } else {
      setMessage(t("success"));
      // The page is server-rendered; refresh to pull the new assignment row.
      window.location.reload();
      return;
    }

    setAssigning(false);
  }

  async function transition(
    row: AdminRoleAssignmentRow,
    next: "verified" | "rejected" | "revoked",
  ) {
    const key = `${row.id}-${next}`;
    if (busyKey) return;
    if (!window.confirm(t("confirmAction"))) return;

    setBusyKey(key);
    setError(null);
    setMessage(null);

    const result = await setRoleVerificationAction(row.id, next);

    if (result.status === "error") {
      setError(result.error ?? t("failed"));
      setBusyKey(null);
      return;
    }

    setRows((current) =>
      current.map((item) =>
        item.id === row.id
          ? { ...item, verification_status: next }
          : item,
      ),
    );
    setMessage(t("success"));
    setBusyKey(null);
  }

  function statusLabel(status: RoleStatus) {
    switch (status) {
      case "pending":
        return t("statusPending");
      case "verified":
        return t("statusVerified");
      case "rejected":
        return t("statusRejected");
      case "revoked":
        return t("statusRevoked");
      case "expired":
        return t("statusExpired");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={assign} className="flex flex-col gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field htmlFor="role-member" label={t("member")}>
            <select
              id="role-member"
              required
              value={assignUserId}
              onChange={(event) => setAssignUserId(event.target.value)}
              className={selectClasses}
            >
              <option value="">—</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.fullName} (@{member.username})
                </option>
              ))}
            </select>
          </Field>

          <Field htmlFor="role-definition" label={t("role")}>
            <select
              id="role-definition"
              required
              value={assignRoleId}
              onChange={(event) => setAssignRoleId(event.target.value)}
              className={selectClasses}
            >
              <option value="">—</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name_en}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <div>
          <Button
            type="submit"
            size="sm"
            isLoading={assigning}
            disabled={!assignUserId || !assignRoleId}
          >
            {t("verify")}
          </Button>
        </div>
      </form>

      {error ? (
        <p role="alert" className="rounded-control bg-danger/10 px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-control bg-brand-soft px-3 py-2 text-sm text-brand">
          {message}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <p className="rounded-control bg-surface-2 px-3 py-2 text-sm text-muted">
          {t("emptyBody")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs uppercase text-muted">
                <th className="py-2 text-start font-semibold">{t("member")}</th>
                <th className="py-2 text-start font-semibold">{t("role")}</th>
                <th className="py-2 text-start font-semibold">{t("status")}</th>
                <th className="py-2 text-start font-semibold">{t("actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-border last:border-b-0">
                  <td className="py-2 pe-3">
                    <span className="block truncate font-semibold text-text">
                      {row.user?.full_name ?? "—"}
                    </span>
                    <span className="block truncate text-xs text-muted" dir="ltr">
                      @{row.user?.username}
                    </span>
                  </td>
                  <td className="py-2 pe-3">
                    <span className="block truncate text-text">
                      {row.role?.name_en ?? "—"}
                    </span>
                  </td>
                  <td className="py-2 pe-3">
                    <Chip tone={statusTone[row.verification_status]}>
                      {statusLabel(row.verification_status)}
                    </Chip>
                    {row.verification_status === "verified" && row.verifier ? (
                      <span className="mt-0.5 block text-xs text-muted">
                        {t("verifiedBy", { name: row.verifier.full_name })}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <span className="flex flex-wrap items-center gap-1.5">
                      {row.verification_status !== "verified" ? (
                        <Button
                          size="sm"
                          variant="primary"
                          isLoading={busyKey === `${row.id}-verified`}
                          onClick={() => transition(row, "verified")}
                        >
                          {t("verify")}
                        </Button>
                      ) : null}
                      {row.verification_status === "pending" ? (
                        <Button
                          size="sm"
                          variant="secondary"
                          isLoading={busyKey === `${row.id}-rejected`}
                          onClick={() => transition(row, "rejected")}
                        >
                          {t("reject")}
                        </Button>
                      ) : null}
                      {row.verification_status === "verified" ? (
                        <Button
                          size="sm"
                          variant="danger"
                          isLoading={busyKey === `${row.id}-revoked`}
                          onClick={() => transition(row, "revoked")}
                        >
                          {t("revoke")}
                        </Button>
                      ) : null}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
