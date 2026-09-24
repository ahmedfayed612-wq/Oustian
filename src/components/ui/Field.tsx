import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Form field kit. One place defines how inputs, selects and textareas look, so
 * every form in the app (signup, profile, admin) stays visually identical —
 * including in RTL, since only logical utilities are used.
 */

export const inputClasses = cn(
  "min-h-11 w-full rounded-control border border-border bg-surface px-3 text-[0.9375rem] text-text",
  "placeholder:text-muted",
  "transition-colors duration-200 ease-out-soft",
  "hover:border-border-strong focus:border-brand focus:outline-none",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-muted",
  "aria-invalid:border-danger",
);

export const selectClasses = cn(inputClasses, "pe-8");

export const textareaClasses = cn(
  inputClasses,
  "min-h-24 resize-y py-2 leading-relaxed",
);

export type FieldProps = {
  /** Must match the control's `id` for the label to bind. */
  htmlFor: string;
  label: string;
  hint?: string;
  error?: string;
  /** Rendered under the label, e.g. "3-24 characters, a-z and _". */
  description?: string;
  className?: string;
  children: ReactNode;
};

export function Field({
  htmlFor,
  label,
  hint,
  error,
  description,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-semibold text-text">
        {label}
      </label>

      {description ? (
        <p id={`${htmlFor}-description`} className="text-xs text-muted">
          {description}
        </p>
      ) : null}

      {children}

      {error ? (
        <p id={`${htmlFor}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
