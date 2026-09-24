"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Link, usePathname } from "@/i18n/navigation";
import { isNavItemActive, navItems } from "./nav-items";

/**
 * Phone navigation. Icon + label with the active tab marked by the short bar
 * along the top edge — the Facebook pattern — and safe-area padding so it stays
 * clear of the home indicator.
 */
export function BottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-safe backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid h-14 max-w-lg grid-cols-5">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);

          return (
            <li key={item.href} className="relative">
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-[3px] rounded-b-pill bg-brand"
                />
              ) : null}
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-full flex-col items-center justify-center gap-0.5 text-[0.6875rem] font-semibold transition-colors duration-200 ease-out-soft",
                  active ? "text-brand" : "text-muted",
                )}
              >
                <item.Icon
                  aria-hidden="true"
                  className={cn(
                    "size-6",
                    active ? "stroke-[2.3]" : "stroke-[1.7]",
                  )}
                />
                <span className="truncate px-0.5">{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
