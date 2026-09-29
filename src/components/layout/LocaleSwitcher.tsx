"use client";

import { useLocale, useTranslations } from "next-intl";
import { useTransition } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { locales, type Locale } from "@/i18n/routing";
import { cn } from "@/lib/utils/cn";

/**
 * The letter each language is recognised by: Arabic by its own first letter,
 * English by "E". One glyph, so the control is the same width in both
 * directions and never crowds the rest of the top bar.
 */
const languageMark: Record<Locale, string> = {
  ar: "ع",
  en: "E",
};

/**
 * Flips between Arabic and English, keeping the current page (next-intl v4
 * takes the target locale in the options object). The choice is stored in a
 * cookie; once a user is signed in it is mirrored to `profiles.language`.
 *
 * The control shows the language you are *in* (`ع` while reading Arabic, `E`
 * while reading English) and its accessible name says where tapping takes you,
 * so the visible mark and the announced action can never contradict each other.
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
        "inline-flex size-11 shrink-0 items-center justify-center rounded-pill text-sm font-bold text-muted transition duration-200 ease-out-soft hover:bg-brand-soft hover:text-brand disabled:opacity-55",
        className,
      )}
    >
      <span aria-hidden="true" className="leading-none">
        {languageMark[locale]}
      </span>
    </button>
  );
}
