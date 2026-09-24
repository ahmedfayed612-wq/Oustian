import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Form-level feedback banner. `tone="error"` is announced assertively so screen
 * readers hear a failed submit immediately; success is a polite status.
 */
export function FormMessage({
  tone,
  children,
  className,
}: {
  tone: "error" | "success";
  children: React.ReactNode;
  className?: string;
}) {
  const Icon = tone === "error" ? AlertTriangle : CheckCircle2;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-control border px-3 py-2 text-sm",
        tone === "error"
          ? "border-danger/30 bg-danger-soft text-danger"
          : "border-brand/25 bg-brand-soft text-brand",
        className,
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}
