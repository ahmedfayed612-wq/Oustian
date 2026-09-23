"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/BrandMark";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { iconButtonClasses } from "@/components/ui/icon-button-classes";
import { Link, usePathname } from "@/i18n/navigation";
import { LocaleSwitcher } from "./LocaleSwitcher";
import { isNavItemActive, navItems } from "./nav-items";

/**
 * Mobile: brand mark + the locale/theme/notification controls.
 * Desktop: the current section name (the brand lives in the sidebar instead).
 */
export function TopBar() {
  const tNav = useTranslations("Nav");
  const tTopBar = useTranslations("TopBar");
  const tBrand = useTranslations("Brand");
  const pathname = usePathname();

  const activeItem = navItems.find((item) =>
    isNavItemActive(pathname, item.href),
  );

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-bg/85 pt-safe backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-2 px-3 md:px-6">
        <Link
          href="/"
          aria-label={tBrand("homeLabel")}
          className="inline-flex rounded-control md:hidden"
        >
          <BrandMark size="md" />
        </Link>

        <span className="hidden text-base font-semibold text-text md:inline">
          {activeItem ? tNav(activeItem.labelKey) : tBrand("name")}
        </span>

        <div className="flex items-center gap-0.5">
          <LocaleSwitcher />
          <ThemeToggle />
          <Link
            href="/notifications"
            aria-label={tTopBar("notifications")}
            title={tTopBar("notifications")}
            className={iconButtonClasses({ variant: "plain" })}
          >
            <Bell className="size-5" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </header>
  );
}
