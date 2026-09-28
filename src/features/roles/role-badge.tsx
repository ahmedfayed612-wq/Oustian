"use client";

import { useLocale } from "next-intl";
import { Award, GraduationCap, ShieldCheck, Sparkles, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { UserVerifiedRole } from "./queries";

export type RoleBadgeProps = {
  role: UserVerifiedRole;
  size?: "sm" | "md";
  showIcon?: boolean;
  className?: string;
};

const categoryStyles: Record<
  UserVerifiedRole["category"],
  {
    bg: string;
    border: string;
    text: string;
    icon: typeof Award;
  }
> = {
  leadership: {
    bg: "bg-amber-500/10 dark:bg-amber-400/10",
    border: "border-amber-500/30 dark:border-amber-400/30",
    text: "text-amber-700 dark:text-amber-300",
    icon: ShieldCheck,
  },
  teaching: {
    bg: "bg-emerald-500/10 dark:bg-emerald-400/10",
    border: "border-emerald-500/30 dark:border-emerald-400/30",
    text: "text-emerald-700 dark:text-emerald-300",
    icon: GraduationCap,
  },
  administrative: {
    bg: "bg-sky-500/10 dark:bg-sky-400/10",
    border: "border-sky-500/30 dark:border-sky-400/30",
    text: "text-sky-700 dark:text-sky-300",
    icon: UserCheck,
  },
  support: {
    bg: "bg-indigo-500/10 dark:bg-indigo-400/10",
    border: "border-indigo-500/30 dark:border-indigo-400/30",
    text: "text-indigo-700 dark:text-indigo-300",
    icon: Sparkles,
  },
  other: {
    bg: "bg-surface-2",
    border: "border-border",
    text: "text-muted",
    icon: Award,
  },
};

export function RoleBadge({
  role,
  size = "sm",
  showIcon = true,
  className,
}: RoleBadgeProps) {
  const locale = useLocale();
  const isArabic = locale === "ar";
  const name = isArabic ? role.nameAr : role.nameEn;
  const config = categoryStyles[role.category] ?? categoryStyles.other;
  const IconComponent = config.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill font-medium transition-colors border",
        size === "sm"
          ? "px-2 py-0.5 text-[0.6875rem] leading-none"
          : "px-2.5 py-1 text-xs leading-none",
        config.bg,
        config.border,
        config.text,
        className,
      )}
      title={`${name} (Verified Institutional Role)`}
    >
      {showIcon && <IconComponent className={cn(size === "sm" ? "size-3" : "size-3.5", "shrink-0")} />}
      <span className="truncate max-w-[12rem]">{name}</span>
    </span>
  );
}

export function RoleBadgeList({
  roles,
  size = "sm",
  limit = 2,
  className,
}: {
  roles?: UserVerifiedRole[];
  size?: "sm" | "md";
  limit?: number;
  className?: string;
}) {
  if (!roles || roles.length === 0) return null;

  const displayRoles = roles.slice(0, limit);
  const remaining = roles.length - limit;

  return (
    <div className={cn("inline-flex items-center flex-wrap gap-1", className)}>
      {displayRoles.map((role) => (
        <RoleBadge key={role.id} role={role} size={size} />
      ))}
      {remaining > 0 && (
        <span className="text-[0.6875rem] text-muted">+{remaining}</span>
      )}
    </div>
  );
}
