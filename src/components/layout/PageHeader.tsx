import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Page title used by every section screen, mirroring the header row of a social
 * network section page (title + one-line description + optional action).
 */
export function PageHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end justify-between gap-x-3 gap-y-2",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-xl leading-tight font-bold text-text">{title}</h1>
        {description ? (
          <p className="mt-1 text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
