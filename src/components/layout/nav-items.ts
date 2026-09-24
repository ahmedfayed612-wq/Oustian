import {
  Bell,
  CalendarDays,
  Home,
  MessageCircle,
  Settings,
  SquarePen,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItemKey =
  | "home"
  | "events"
  | "chat"
  | "notifications"
  | "profile"
  | "create"
  | "settings"
  | "admin";

export type NavItem = {
  href: string;
  labelKey: NavItemKey;
  Icon: LucideIcon;
};

/**
 * The five primary destinations — one source of truth for the desktop top-bar
 * tabs, the left rail and the mobile bottom bar. This is the familiar
 * social-network set: feed, events, messages, notifications, profile.
 */
export const navItems: readonly NavItem[] = [
  { href: "/", labelKey: "home", Icon: Home },
  { href: "/events", labelKey: "events", Icon: CalendarDays },
  { href: "/chat", labelKey: "chat", Icon: MessageCircle },
  { href: "/notifications", labelKey: "notifications", Icon: Bell },
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
