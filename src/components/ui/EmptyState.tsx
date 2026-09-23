import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export type EmptyStateProps = {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

/** Friendly placeholder for "nothing here yet" and "not built yet" screens. */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-card-lg border border-dashed border-border bg-surface/70 px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <span className="flex size-12 items-center justify-center rounded-pill bg-brand-soft text-brand">
          {icon}
        </span>
      ) : null}
      <p className="text-base font-semibold text-text">{title}</p>
      {description ? (
        <p className="max-w-sm text-sm text-muted">{description}</p>
      ) : null}
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}
