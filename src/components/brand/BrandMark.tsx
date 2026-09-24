import { cn } from "@/lib/utils/cn";

/**
 * The OUST peak — the three overlapping geometric chevrons from the university
 * logo, redrawn as clean vectors so they stay crisp at every size and follow the
 * theme (the gold token lightens in dark mode automatically).
 *
 * `tone` keeps the mark usable on any background:
 *   `gold`    the logo's antique gold (default, used in the app chrome)
 *   `brand`   petrol teal, for use on gold/photo surfaces
 *   `current` inherits the text colour (inside coloured chips and buttons)
 */
export type PeakTone = "gold" | "brand" | "current";

const peakToneFill: Record<PeakTone, string> = {
  gold: "var(--accent)",
  brand: "var(--brand)",
  current: "currentColor",
};

/**
 * A single chevron ("Λ" with a flat underside) as a polygon, so the three peaks
 * can be described by geometry instead of hand-tuned path data.
 */
function chevronPoints(options: {
  apexX: number;
  apexY: number;
  halfWidth: number;
  baseY: number;
  thickness: number;
}) {
  const { apexX, apexY, halfWidth, baseY, thickness } = options;
  const innerApexY = apexY + thickness * 1.75;

  return [
    [apexX, apexY],
    [apexX + halfWidth, baseY],
    [apexX + halfWidth - thickness, baseY],
    [apexX, innerApexY],
    [apexX - halfWidth + thickness, baseY],
    [apexX - halfWidth, baseY],
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

export function PeakMark({
  className,
  tone = "gold",
}: {
  className?: string;
  tone?: PeakTone;
}) {
  const fill = peakToneFill[tone];

  return (
    <svg
      viewBox="0 0 48 32"
      className={cn("block", className)}
      aria-hidden="true"
      focusable="false"
    >
      {/* back-right peak */}
      <polygon
        points={chevronPoints({
          apexX: 33.5,
          apexY: 8.5,
          halfWidth: 12.5,
          baseY: 29.5,
          thickness: 4.2,
        })}
        fill={fill}
        opacity="0.78"
      />
      {/* inner step — the small peak that echoes the middle of the logo */}
      <polygon
        points={chevronPoints({
          apexX: 24.5,
          apexY: 13,
          halfWidth: 8,
          baseY: 29.5,
          thickness: 3.6,
        })}
        fill={fill}
        opacity="0.9"
      />
      {/* front-left peak */}
      <polygon
        points={chevronPoints({
          apexX: 16.5,
          apexY: 2.5,
          halfWidth: 14,
          baseY: 29.5,
          thickness: 4.2,
        })}
        fill={fill}
      />
    </svg>
  );
}

type BrandMarkSize = "sm" | "md" | "lg";

/** The mark is a 3:2 lockup, so widths are derived from the matching height. */
const markSizes: Record<BrandMarkSize, string> = {
  sm: "h-4 w-6",
  md: "h-5 w-[30px]",
  lg: "h-7 w-[42px]",
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
