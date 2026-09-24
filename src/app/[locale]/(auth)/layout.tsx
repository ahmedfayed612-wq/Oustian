import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { UniversityLogo } from "@/components/brand/UniversityLogo";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { getSessionState } from "@/features/auth/session";

/**
 * Chrome for sign-in, sign-up and the holding screen: the OUST lockup over a
 * single centred card, with language and theme still switchable (a first-time
 * visitor decides both before they have an account).
 *
 * Approved members are bounced straight to the feed, so these screens can never
 * be used as a "logged in" state.
 */
export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const state = await getSessionState();
  const locale = await getLocale();

  if (state.status === "approved") {
    redirect(`/${locale}/`);
  }

  const t = await getTranslations("Auth");

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-end gap-0.5 px-3 py-2 pt-safe">
        <LocaleSwitcher />
        <ThemeToggle />
      </header>

      <main
        id="main-content"
        className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-12"
      >
        <UniversityLogo size="md" />
        <div className="w-full max-w-md">{children}</div>
        <p className="max-w-sm text-center text-xs leading-relaxed text-muted">
          {t("campusNote")}
        </p>
      </main>
    </div>
  );
}
