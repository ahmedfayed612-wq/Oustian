import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";
import {
  iconButtonBaseClasses,
  iconButtonVariantClasses,
} from "./icon-button-classes";

type IconButtonVariant = keyof typeof iconButtonVariantClasses;

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  /** Required: icon-only controls must have an accessible name. */
  label: string;
  variant?: IconButtonVariant;
};

/** 44x44 round icon button. */
export function IconButton({
  label,
  variant = "plain",
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        iconButtonBaseClasses,
        iconButtonVariantClasses[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
