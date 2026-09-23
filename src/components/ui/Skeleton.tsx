import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

/** Loading placeholder. Pulses gently, and not at all for reduced-motion users. */
export function Skeleton({
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-pulse rounded-control bg-muted-decor/20 motion-reduce:animate-none",
        className,
      )}
      {...rest}
    />
  );
}
