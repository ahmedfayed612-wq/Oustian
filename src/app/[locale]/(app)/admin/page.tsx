import { UserCheck, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { requireAdmin } from "@/features/auth/session";
import { facultyOptions } from "@/lib/profile-options";
import { createClient } from "@/lib/supabase/server";
import { ApprovalQueue, type PendingMember } from "./approval-queue";
import { InviteCodeManager, type InviteCodeRow } from "./invite-code-manager";

export async function generateMetadata() {
  const t = await getTranslations("Admin");

  return { title: t("title") };
}

/**
 * Admin console: the approval queue and the invite codes.
 *
 * Access is enforced three times over — the `(app)/admin` layout, `requireAdmin`
 * here, and RLS in Postgres — so this page can be safely linked from anywhere.
 */
export default async function AdminPage() {
  await requireAdmin();

  const t = await getTranslations("Admin");
  const locale = await getLocale();
  const supabase = await createClient();

  const [pendingResult, codesResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, full_name, username, faculty, graduation_year, created_at, verification_method",
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("invite_codes")
      .select("id, code, label, uses, max_uses, expires_at, is_active")
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  const facultyLabel = (value: string | null) => {
    const option = facultyOptions.find((item) => item.value === value);

    return option ? (locale === "ar" ? option.nameAr : option.nameEn) : null;
  };

  const members: PendingMember[] = (pendingResult.data ?? []).map((row) => ({
    id: row.id,
    fullName: row.full_name,
    username: row.username,
    detail: [
      facultyLabel(row.faculty),
      row.graduation_year ? String(row.graduation_year) : null,
    ]
      .filter((part): part is string => Boolean(part))
      .join(" · "),
    verification: row.verification_method,
    requestedAt: row.created_at,
  }));

  const codes: InviteCodeRow[] = (codesResult.data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    uses: row.uses,
    maxUses: row.max_uses,
    expiresAt: row.expires_at,
    isActive: row.is_active,
  }));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-bold text-text">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <Chip tone={members.length > 0 ? "accent" : "neutral"}>
            <UserCheck className="size-3.5" aria-hidden="true" />
            {t("pendingCount", { count: members.length })}
          </Chip>
          <Chip>
            <Users className="size-3.5" aria-hidden="true" />
            {t("codeCount", { count: codes.length })}
          </Chip>
        </div>
      </div>

      <Card className="p-4">
        <h2 className="text-[0.9375rem] font-semibold text-text">
          {t("queueTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("queueBody")}</p>

        <div className="mt-3">
          <ApprovalQueue members={members} />
        </div>
      </Card>

      <Card className="p-4">
        <h2 className="text-[0.9375rem] font-semibold text-text">
          {t("invitesTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("invitesBody")}</p>

        <div className="mt-3">
          <InviteCodeManager codes={codes} />
        </div>
      </Card>
    </div>
  );
}
