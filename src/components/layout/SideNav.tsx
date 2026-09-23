"use client";

import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/BrandMark";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { isNavItemActive, navItems } from "./nav-items";

/**
 * Desktop navigation. Sits inline-start and stays put while the feed scrolls.
 * A gold bar marks the active item (the accent stays rare on purpose).
 */
export function SideNav() {
  const tNav = useTranslations("Nav");
  const tBrand = useTranslations("Brand");
  const pathname = usePathname();

  return (
    <nav
      aria-label={tNav("label")}
      className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] w-64 shrink-0 flex-col border-e border-border px-3 py-4 md:flex"
    >
      <Link
        href="/"
        aria-label={tBrand("homeLabel")}
        className="mb-5 inline-flex w-fit rounded-control px-1 py-1"
      >
        <BrandMark size="lg" />
      </Link>

      <ul className="flex flex-col gap-1">
        {navItems.map((item) => {
          const active = isNavItemActive(pathname, item.href);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-11 items-center gap-3 rounded-control px-3 text-[0.9375rem] font-semibold transition-colors duration-200 ease-out-soft",
                  active
                    ? "bg-brand-soft text-brand"
                    : "text-muted hover:bg-brand-soft/60 hover:text-text",
                )}
              >
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 start-0 w-1 rounded-pill bg-accent"
                  />
                ) : null}
                <item.Icon aria-hidden="true" className="size-5" />
                <span>{tNav(item.labelKey)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
