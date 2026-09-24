import Image from "next/image";
import { UserRound } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export type AvatarSize = "xs" | "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<AvatarSize, string> = {
  xs: "size-6 text-[0.5625rem]",
  sm: "size-8 text-[0.6875rem]",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-24 text-3xl",
};

/** Pixel dimensions for `next/image` (see `images.remotePatterns`). */
const pixelSizes: Record<AvatarSize, number> = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 56,
  xl: 96,
};

/** "Sara Ahmed Ali" -> "SA" — used until a member uploads a photo. */
function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2);

  return `${parts[0][0]}${parts[1][0]}`;
}

export type AvatarProps = {
  /** Used as the accessible name and to derive the initials fallback. */
  name?: string;
  /** Storage URL of the member's photo. Falls back to initials when absent. */
  src?: string | null;
  size?: AvatarSize;
  /** Thin outline — used when the avatar sits on a card of the same colour. */
  ring?: boolean;
  className?: string;
};

/**
 * Member avatar. Photos are served from Supabase Storage; until a member has
 * one, the fallback shows their initials on a brand-tinted circle.
 */
export function Avatar({
  name,
  src,
  size = "md",
  ring = false,
  className,
}: AvatarProps) {
  const label = name?.trim() || undefined;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden rounded-pill bg-brand-soft font-semibold text-brand uppercase select-none",
        sizeClasses[size],
        ring && "ring-1 ring-border",
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={label ?? ""}
          width={pixelSizes[size]}
          height={pixelSizes[size]}
          className="size-full object-cover"
        />
      ) : (
        <span aria-hidden={label ? undefined : "true"}>
          {" "}
          {label ? (
            initialsOf(label)
          ) : (
            <UserRound className="size-[58%]" aria-hidden="true" />
          )}
        </span>
      )}
    </span>
  );
}
