import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import { Spinner } from "./Spinner";

export type ButtonVariant =
  "primary" | "secondary" | "ghost" | "accent" | "danger";

export type ButtonSize = "sm" | "md" | "lg";

/**
 * Minimum tap target is 44px (`min-h-11`). `sm` stays at 40px and should only be
 * used for dense secondary actions on wide screens.
 */
const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-10 px-3.5 text-sm",
  md: "min-h-11 px-4 text-[0.9375rem]",
  lg: "min-h-12 px-5 text-base",
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-strong",
  secondary:
    "border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2",
  ghost: "text-muted hover:bg-surface-2 hover:text-brand",
  accent: "bg-accent text-on-accent hover:brightness-105",
  danger: "bg-danger text-on-danger hover:brightness-110",
};

const baseClasses =
  "inline-flex items-center justify-center gap-2 rounded-control font-semibold leading-none transition duration-200 ease-out-soft select-none disabled:pointer-events-none disabled:opacity-55 aria-busy:cursor-progress";

export function buttonClasses(options?: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}) {
  const { variant = "primary", size = "md", className } = options ?? {};

  return cn(baseClasses, variantClasses[variant], sizeClasses[size], className);
}

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  /** Announced while `isLoading` is true. */
  loadingLabel?: string;
};

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  loadingLabel,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClasses({ variant, size, className })}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {isLoading ? <Spinner label={loadingLabel} /> : null}
      {children}
    </button>
  );
}
