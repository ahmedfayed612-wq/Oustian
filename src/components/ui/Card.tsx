import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Rounded surface used for every block of content (posts, panels, forms).
 * Padding is left to the caller so cards can be edge-to-edge with media.
 */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface shadow-soft",
        className,
      )}
      {...rest}
    />
  );
}
