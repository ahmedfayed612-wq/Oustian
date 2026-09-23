import type { ButtonHTMLAttributes, HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type ChipTone = "neutral" | "brand" | "accent";

const toneClasses: Record<ChipTone, string> = {
  neutral: "border-border bg-surface text-muted",
  brand: "border-brand/30 bg-brand-soft text-brand",
  accent: "border-accent/40 bg-accent-soft text-accent-ink",
};

/** Static pill label. */
export function Chip({
  tone = "neutral",
  className,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: ChipTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
      {...rest}
    />
  );
}

export type ChipButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  selected?: boolean;
  tone?: ChipTone;
};

/** Selectable pill — used for feed tabs, filters and reason pickers. */
export function ChipButton({
  selected = false,
  tone = "brand",
  className,
  children,
  type = "button",
  ...rest
}: ChipButtonProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-pill border px-3.5 text-sm font-semibold transition duration-200 ease-out-soft",
        selected
          ? toneClasses[tone]
          : "border-border bg-surface text-muted hover:border-border-strong hover:text-text",
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
