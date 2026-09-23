import { cn } from "@/lib/utils/cn";

/**
 * Placeholder brand mark for Oustians.
 *
 * ⚠️ Deliberately NOT the university logo — using the official OUST mark in the
 * app requires the university's permission. This is a simple geometric peak
 * inspired by that mark, paired with an "Oustians" wordmark.
 *
 * To swap in the final artwork: replace `PeakMark`'s paths with the provided
 * SVG (keep it `currentColor`/token driven so light + dark mode still work) and
 * leave everything else untouched — no other file references the artwork.
 */
export function PeakMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 24"
      className={cn("block", className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* back peak — gold/tan, the accent from the university mark */}
      <path d="M20.5 0.8 31.6 23H9.4Z" fill="var(--accent)" />
      {/* front peak — deep teal, overlapping the gold one */}
      <path d="M11.6 7.4 22.8 23H0.4Z" fill="var(--brand)" />
    </svg>
  );
}

type BrandMarkSize = "sm" | "md" | "lg";

const markSizes: Record<BrandMarkSize, string> = {
  sm: "h-4 w-[21px]",
  md: "h-5 w-[27px]",
  lg: "h-7 w-[37px]",
};

const wordmarkSizes: Record<BrandMarkSize, string> = {
  sm: "text-sm",
  md: "text-[1.0625rem]",
  lg: "text-2xl",
};

export type BrandMarkProps = {
  /** `full` = peak + wordmark, `mark` = peak only (e.g. app icon contexts). */
  variant?: "full" | "mark";
  size?: BrandMarkSize;
  className?: string;
};

export function BrandMark({
  variant = "full",
  size = "md",
  className,
}: BrandMarkProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <PeakMark className={cn("shrink-0", markSizes[size])} />
      {variant === "full" ? (
        <span
          className={cn(
            "font-bold tracking-[0.18em] text-brand uppercase",
            wordmarkSizes[size],
          )}
        >
          Oustians
        </span>
      ) : null}
    </span>
  );
}
