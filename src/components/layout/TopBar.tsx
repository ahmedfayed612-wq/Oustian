"use client";

import { Search, SquarePen } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark, PeakMark } from "@/components/brand/BrandMark";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { iconButtonClasses } from "@/components/ui/icon-button-classes";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { NotificationButton } from "@/features/notifications/notification-button";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { LocaleSwitcher } from "./LocaleSwitcher";
import type { ChromeMember } from "./member";
import { isNavItemActive, navItems } from "./nav-items";

/**
 * The social-network top bar: brand + search on the start edge, the section
 * tabs centred (the pattern Facebook and LinkedIn both use so the current area
 * is always visible), and the action cluster on the end edge. Everything the
 * tabs carry is duplicated in the left rail on lg+ and in the bottom bar on
 * phones, so nothing becomes unreachable at any width.
 *
 * The bar is width-budgeted rather than merely responsive: a 360 px screen gets
 * the mark (not the wordmark), search, create, the language indicator and the
 * bell — five 44 px targets that fit — while the theme switch (also in
 * Settings) and the avatar (Profile is a bottom-bar tab) appear once there is
 * room at 640 px and 768 px. Without that budget the row overflows the
 * viewport, which is exactly how a phone ends up scrolling sideways.
 */
export function TopBar({
  member,
  unreadNotifications,
}: {
  member: ChromeMember;
  unreadNotifications: number;
}) {
  const tNav = useTranslations("Nav");
  const tBrand = useTranslations("Brand");
  const tSearch = useTranslations("Search");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 pt-safe backdrop-blur-md">
      <div className="relative mx-auto flex h-14 w-full max-w-[78rem] items-center gap-1.5 px-2 md:gap-2 md:px-4">
        <Link
          href="/"
          aria-label={tBrand("homeLabel")}
          className="inline-flex shrink-0 items-center rounded-control"
        >
          {/* Mark only on phones, full lockup from `sm` — the wordmark alone
              is wider than the rest of the cluster put together. */}
          <PeakMark className="h-5 w-[30px] sm:hidden" />
          <BrandMark size="md" className="hidden sm:inline-flex" />
        </Link>

        {/* Search: a field from xl, an icon button below that. */}
        <Link
          href="/search"
          className="hidden min-h-11 w-56 items-center gap-2 rounded-pill bg-surface-2 px-4 text-sm text-muted transition-colors duration-200 ease-out-soft hover:bg-surface-2/70 2xl:flex"
        >
          <Search className="size-4" aria-hidden="true" />
          <span className="truncate">{tSearch("placeholder")}</span>
        </Link>
        <Link
          href="/search"
          aria-label={tSearch("label")}
          title={tSearch("label")}
          className={cn(iconButtonClasses(), "2xl:hidden")}
        >
          <Search className="size-5" aria-hidden="true" />
        </Link>

        <nav
          aria-label={tNav("label")}
          className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-0.5 lg:flex"
        >
          {navItems.map((item) => {
            const active = isNavItemActive(pathname, item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={tNav(item.labelKey)}
                className={cn(
                  "relative flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-control px-3 text-[0.6875rem] font-semibold transition-colors duration-200 ease-out-soft",
                  active
                    ? "text-brand"
                    : "text-muted hover:bg-surface-2 hover:text-text",
                )}
              >
                <item.Icon
                  aria-hidden="true"
                  className={cn(
                    "size-6",
                    active ? "stroke-[2.3]" : "stroke-[1.7]",
                  )}
                />
                <span className="hidden xl:inline">{tNav(item.labelKey)}</span>
                {active ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-1.5 -bottom-0.5 h-0.5 rounded-pill bg-brand"
                  />
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="ms-auto flex items-center gap-0.5">
          <Link
            href="/create"
            className={cn(
              buttonClasses({ size: "sm" }),
              "hidden md:inline-flex",
            )}
          >
            <SquarePen className="size-4" aria-hidden="true" />
            <span className="hidden xl:inline">{tNav("create")}</span>
          </Link>
          <Link
            href="/create"
            aria-label={tNav("create")}
            title={tNav("create")}
            className={cn(iconButtonClasses(), "md:hidden")}
          >
            <SquarePen className="size-5" aria-hidden="true" />
          </Link>

          <LocaleSwitcher />

          {/* The theme cycle also lives in Settings, so on a phone the header
              spends its width on destinations that exist nowhere else. */}
          <ThemeToggle className="hidden sm:inline-flex" />

          <NotificationButton unreadCount={unreadNotifications} />

          <Link
            href="/profile"
            aria-label={member.fullName}
            title={member.fullName}
            className="ms-1 hidden rounded-pill md:inline-flex"
          >
            <Avatar
              size="sm"
              ring
              name={member.fullName}
              src={member.avatarUrl}
            />
          </Link>
        </div>
      </div>
    </header>
  );
}
