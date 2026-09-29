import {
  CalendarDays,
  Home,
  MessageCircle,
  Settings,
  SquarePen,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItemKey =
  | "home"
  | "events"
  | "chat"
  | "profile"
  | "create"
  | "settings"
  | "groups"
  | "admin";

/** Keys used only where the label has to be short (the phone bottom bar). */
export type NavShortLabelKey = "groupsShort";

export type NavItem = {
  href: string;
  labelKey: NavItemKey;
  Icon: LucideIcon;
  /**
   * Optional shorter label for the bottom bar, where five destinations share a
   * 360 px row. The full label stays the accessible name.
   */
  shortLabelKey?: NavShortLabelKey;
};

/**
 * The five primary destinations — one source of truth for the desktop top-bar
 * tabs, the left rail and the mobile bottom bar: feed, events, messages, the
 * presentation groups members work in, and their profile.
 *
 * Notifications deliberately left this set: on a phone it now lives in the top
 * bar next to the wordmark, where it is reachable from every screen and can
 * carry its unread count, and the fourth slot carries the groups workspace
 * instead.
 */
export const navItems: readonly NavItem[] = [
  { href: "/", labelKey: "home", Icon: Home },
  { href: "/events", labelKey: "events", Icon: CalendarDays },
  { href: "/chat", labelKey: "chat", Icon: MessageCircle },
  {
    href: "/groups",
    labelKey: "groups",
    Icon: UsersRound,
    shortLabelKey: "groupsShort",
  },
  { href: "/profile", labelKey: "profile", Icon: UserRound },
];

/** Secondary destinations, listed under "Shortcuts" in the left rail. */
export const shortcutNavItems: readonly NavItem[] = [
  { href: "/create", labelKey: "create", Icon: SquarePen },
  { href: "/settings", labelKey: "settings", Icon: Settings },
];

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";

  return pathname === href || pathname.startsWith(`${href}/`);
}
