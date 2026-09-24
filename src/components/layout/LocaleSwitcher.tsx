"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils/cn";

/**
 * Flips between Arabic and English, keeping the current page (next-intl v4
 * takes the target locale in the options object). The choice is stored in a
 * cookie; once a user is signed in (M1) it is mirrored to `profiles.language`.
 */
export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("Locale");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const next: Locale = locales.find((item) => item !== locale) ?? locale;

  function switchLocale() {
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isPending}
      aria-label={t("switchTo")}
      title={t("switchTo")}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-pill px-3 text-sm font-semibold text-muted transition duration-200 ease-out-soft hover:bg-brand-soft hover:text-brand disabled:opacity-55",
        className,
      )}
    >
      <Languages className="size-5" aria-hidden="true" />
      <span className="hidden md:inline">{t("other")}</span>
    </button>
  );
}
