"use client";

import { useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { isNavItemActive, navItems, shortcutNavItems } from "./nav-items";

/**
 * Left rail (lg and wider): the member's mini profile card on top, the primary
 * navigation under it and shortcuts at the bottom — the column every social
 * network puts beside the feed. Hidden below `lg`, where the top bar and the
 * bottom bar carry the same links.
 */
export function SideNav() {
  const tNav = useTranslations("Nav");
  const tProfile = useTranslations("ProfileCard");
  const tBrand = useTranslations("Brand");
  const pathname = usePathname();

  return (
    <aside className="sticky top-[4.5rem] hidden max-h-[calc(100dvh-5.5rem)] w-60 shrink-0 flex-col gap-3 overflow-y-auto pb-4 lg:flex xl:w-64">
      <Card className="overflow-hidden">
        <div className="h-14 bg-brand-soft" aria-hidden="true" />
        <div className="px-3 pb-3">
          <Link
            href="/profile"
            aria-label={tNav("profile")}
            className="-mt-7 inline-flex rounded-pill ring-2 ring-surface"
          >
            <Avatar size="lg" />
          </Link>
          <p className="mt-2 truncate text-[0.9375rem] font-semibold text-text">
            {tProfile("fallbackName")}
          </p>
          <p className="truncate text-xs text-muted">
            {tProfile("fallbackHeadline")}
          </p>
          <Link
            href="/profile"
            className="mt-3 flex min-h-10 items-center justify-center rounded-control border border-brand/25 bg-brand-soft px-3 text-sm font-semibold text-brand transition-colors duration-200 ease-out-soft hover:bg-brand-soft/70"
          >
            {tProfile("editProfile")}
          </Link>
        </div>
      </Card>

      <nav aria-label={tNav("label")}>
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center gap-3 rounded-control px-3 text-[0.9375rem] transition-colors duration-200 ease-out-soft",
                    active
                      ? "bg-surface-2 font-semibold text-brand"
                      : "font-medium text-text hover:bg-surface-2",
                  )}
                >
                  <item.Icon
                    aria-hidden="true"
                    className={cn(
                      "size-5",
                      active ? "stroke-[2.3]" : "stroke-[1.9]",
                    )}
                  />
                  <span className="truncate">{tNav(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border pt-3">
        <p className="px-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase">
          {tNav("shortcuts")}
        </p>
        <ul className="flex flex-col gap-0.5">
          {shortcutNavItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-10 items-center gap-3 rounded-control px-3 text-sm transition-colors duration-200 ease-out-soft",
                    active
                      ? "bg-surface-2 font-semibold text-brand"
                      : "font-medium text-text hover:bg-surface-2",
                  )}
                >
                  <item.Icon aria-hidden="true" className="size-5" />
                  <span className="truncate">{tNav(item.labelKey)}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        <p className="px-3 pt-5 text-[0.6875rem] leading-relaxed text-muted">
          {tBrand("name")} · {tBrand("tagline")}
        </p>
      </div>
    </aside>
  );
}
