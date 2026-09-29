"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";
import { iconButtonClasses } from "@/components/ui/icon-button-classes";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils/cn";

/** Counts above this read "99+" — the badge is not a metric, it is a nudge. */
const MAX_BADGE_COUNT = 99;

/**
 * The header's notification entry point.
 *
 * Notifications used to live in the phone bottom bar; they sit next to the
 * wordmark now, which is where the familiar social pattern puts them — and it
 * means the bell is reachable from every screen at every width, including the
 * ones where the bottom bar has other work to do.
 *
 * The count comes from the server-rendered chrome (one indexed count per
 * request), so a failed read simply renders as "no badge" instead of an error
 * in the header.
 */
export function NotificationButton({ unreadCount }: { unreadCount: number }) {
  const t = useTranslations("TopBar");

  const hasUnread = unreadCount > 0;
  const label = hasUnread
    ? t("notificationsWithCount", { count: unreadCount })
    : t("notifications");

  return (
    <Link
      href="/notifications"
      aria-label={label}
      title={label}
      className={cn(iconButtonClasses(), "relative")}
    >
      <Bell className="size-5" aria-hidden="true" />

      {hasUnread ? (
        <span
          aria-hidden="true"
          className="absolute end-1 top-1.5 flex min-w-5 items-center justify-center rounded-pill border border-surface bg-brand px-1 text-[0.625rem] font-bold text-on-brand tabular-nums"
        >
          {unreadCount > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
