import {
  CalendarDays,
  Home,
  MessageCircle,
  PlusCircle,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavItemKey = "home" | "events" | "create" | "chat" | "profile";

export type NavItem = {
  href: string;
  labelKey: NavItemKey;
  Icon: LucideIcon;
  /** Rendered as the raised centre action on mobile. */
  emphasized?: boolean;
};

/** One source of truth for the mobile bottom bar, the desktop sidebar and the
 * desktop page title. */
export const navItems: readonly NavItem[] = [
  { href: "/", labelKey: "home", Icon: Home },
  { href: "/events", labelKey: "events", Icon: CalendarDays },
  { href: "/create", labelKey: "create", Icon: PlusCircle, emphasized: true },
  { href: "/chat", labelKey: "chat", Icon: MessageCircle },
  { href: "/profile", labelKey: "profile", Icon: UserRound },
];

export function isNavItemActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";

  return pathname === href || pathname.startsWith(`${href}/`);
}
