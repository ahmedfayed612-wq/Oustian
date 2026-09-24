import { cn } from "@/lib/utils/cn";

type IconButtonVariant = "plain" | "soft" | "brand" | "danger";

/** Shared so icon-only links can look identical to `IconButton`s. */
export const iconButtonVariantClasses: Record<IconButtonVariant, string> = {
  plain:
    "text-muted hover:bg-surface-2 hover:text-brand active:bg-surface-2/70",
  soft: "bg-surface text-text shadow-card hover:bg-surface-2 hover:text-brand",
  brand: "bg-brand text-on-brand hover:brightness-110",
  danger: "text-danger hover:bg-danger-soft",
};

export const iconButtonBaseClasses =
  "inline-flex size-11 shrink-0 items-center justify-center rounded-pill transition duration-200 ease-out-soft disabled:pointer-events-none disabled:opacity-55";

export function iconButtonClasses(options?: {
  variant?: IconButtonVariant;
  className?: string;
}) {
  const { variant = "plain", className } = options ?? {};

  return cn(
    iconButtonBaseClasses,
    iconButtonVariantClasses[variant],
    className,
  );
}
