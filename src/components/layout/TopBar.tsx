"use client";

import { Bell, Search, SquarePen } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/BrandMark";
import { Avatar } from "@/components/ui/Avatar";
import { buttonClasses } from "@/components/ui/Button";
import { iconButtonClasses } from "@/components/ui/icon-button-classes";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { isNavItemActive, navItems } from "./nav-items";

/**
 * The social-network top bar: brand + search on the left, the section tabs
 * centred (the pattern Facebook and LinkedIn both use so the current area is
 * always visible), and the action cluster on the right. Everything the tabs
 * carry is duplicated in the left rail on lg+ and in the bottom bar on phones,
 * so nothing becomes unreachable at any width.
 */
export function TopBar() {
  const tNav = useTranslations("Nav");
  const tTopBar = useTranslations("TopBar");
  const tBrand = useTranslations("Brand");
  const tSearch = useTranslations("Search");
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-surface/95 pt-safe backdrop-blur-md">
      <div className="relative mx-auto flex h-14 w-full max-w-[78rem] items-center gap-2 px-2 md:px-4">
        <Link
          href="/"
          aria-label={tBrand("homeLabel")}
          className="inline-flex shrink-0 rounded-control"
        >
          <BrandMark size="md" />
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
          <ThemeToggle />

          <Link
            href="/notifications"
            aria-label={tTopBar("notifications")}
            title={tTopBar("notifications")}
            className={cn(iconButtonClasses(), "hidden md:inline-flex")}
          >
            <Bell className="size-5" aria-hidden="true" />
          </Link>

          <Link
            href="/profile"
            aria-label={tNav("profile")}
            title={tNav("profile")}
            className="ms-1 inline-flex rounded-pill"
          >
            <Avatar size="sm" ring />
          </Link>
        </div>
      </div>
    </header>
  );
}
