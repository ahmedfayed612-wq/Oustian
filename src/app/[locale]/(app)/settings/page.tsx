import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { signOutAction } from "@/features/auth/actions";
import { requireApprovedMember } from "@/features/auth/session";
import { Button, buttonClasses } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

export async function generateMetadata() {
  const t = await getTranslations("Settings");

  return { title: t("title") };
}

/**
 * Settings hub. Everything here reuses existing primitives (theme cycle,
 * locale flip, profile privacy, admin panel, sign-out) — no new state, no
 * server round trips beyond the session gate.
 */
export default async function SettingsPage() {
  const viewer = await requireApprovedMember();
  const t = await getTranslations("Settings");

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("title")} description={t("description")} />

      <Card className="flex flex-col gap-4 p-5">
        <SettingsRow label={t("appearance")} hint={t("appearanceHint")}>
          <ThemeToggle />
        </SettingsRow>

        <div className="h-px bg-border" aria-hidden="true" />

        <SettingsRow label={t("language")} hint={t("languageHint")}>
          <LocaleSwitcher className="-me-3" />
        </SettingsRow>
      </Card>

      <Card className="flex flex-col gap-4 p-5">
        <SettingsRow label={t("privacy")} hint={t("privacyHint")}>
          <Link
            href="/profile/edit"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            {t("editProfile")}
          </Link>
        </SettingsRow>

        {viewer.role === "admin" ? (
          <>
            <div className="h-px bg-border" aria-hidden="true" />

            <SettingsRow label={t("admin")} hint={t("adminHint")}>
              <Link
                href="/admin"
                className={buttonClasses({ variant: "accent", size: "sm" })}
              >
                <ShieldCheck className="size-4" aria-hidden="true" />
                {t("openAdmin")}
              </Link>
            </SettingsRow>
          </>
        ) : null}
      </Card>

      <Card className="p-5">
        <form action={signOutAction}>
          <Button type="submit" variant="danger" className="w-full sm:w-auto">
            {t("signOut")}
          </Button>
        </form>
      </Card>
    </div>
  );
}

function SettingsRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-text">{label}</p>
        <p className="mt-0.5 text-xs text-muted">{hint}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}
