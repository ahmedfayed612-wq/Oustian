"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils/cn";
import { Link, usePathname } from "@/i18n/navigation";
import { isNavItemActive, navItems } from "./nav-items";

/** Mobile primary navigation. Gold marks the active tab; "Create" is raised. */
export function BottomNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-safe backdrop-blur-md md:hidden"
    >
      <ul className="mx-auto grid h-16 max-w-lg grid-cols-5">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);

          return (
            <li key={item.href} className="relative">
              {active ? (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-pill bg-accent"
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
                {item.emphasized ? (
                  <span
                    className={cn(
                      "flex size-9 items-center justify-center rounded-pill bg-brand text-on-brand shadow-soft transition duration-200 ease-out-soft",
                      active && "ring-2 ring-accent",
                    )}
                  >
                    <item.Icon className="size-5" aria-hidden="true" />
                  </span>
                ) : (
                  <item.Icon
                    aria-hidden="true"
                    className={cn(
                      "size-6",
                      active ? "stroke-[2.4]" : "stroke-[1.8]",
                    )}
                  />
                )}
                <span>{t(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
