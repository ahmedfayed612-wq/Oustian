import {
  BellRing,
  CalendarDays,
  MessageCircle,
  PlusCircle,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Sections that exist as routes but are filled in by later milestones. */
export type PlaceholderSection =
  | "events"
  | "chat"
  | "create"
  | "profile"
  | "settings"
  | "notifications"
  | "admin";

export const placeholderIcons: Record<PlaceholderSection, LucideIcon> = {
  events: CalendarDays,
  chat: MessageCircle,
  create: PlusCircle,
  profile: UserRound,
  settings: Settings,
  notifications: BellRing,
  admin: ShieldCheck,
};

export const placeholderHighlightIcon: LucideIcon = Sparkles;
