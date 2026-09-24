"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils/cn";

/**
 * RSVP toggle: optimistically flips the row through RLS (insert = going,
 * delete = not going) and reverts if the write is refused.
 */
export function RsvpButton({
  eventId,
  meId,
  initialCount,
  initialGoing,
}: {
  eventId: string;
  meId: string;
  initialCount: number;
  initialGoing: boolean;
}) {
  const t = useTranslations("Events");

  const [going, setGoing] = useState(initialGoing);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);

  async function toggle() {
    if (busy) return;

    const wasGoing = going;

    setGoing(!wasGoing);
    setCount((value) => Math.max(0, value + (wasGoing ? -1 : 1)));
    setBusy(true);

    try {
      const supabase = createClient();
      const { error } = wasGoing
        ? await supabase
            .from("event_rsvps")
            .delete()
            .eq("event_id", eventId)
            .eq("user_id", meId)
        : await supabase
            .from("event_rsvps")
            .insert({ event_id: eventId, user_id: meId });

      if (error) {
        setGoing(wasGoing);
        setCount((value) => value + (wasGoing ? 1 : -1));
      }
    } catch {
      setGoing(wasGoing);
      setCount((value) => value + (wasGoing ? 1 : -1));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={going}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-pill px-4 text-sm font-semibold transition-colors",
        going
          ? "bg-brand text-on-brand hover:bg-brand-strong"
          : "border border-border bg-surface text-text hover:border-border-strong hover:bg-surface-2",
      )}
    >
      <Check className="size-4" aria-hidden="true" />
      {going ? t("goingLabel", { count }) : t("rsvp", { count })}
    </button>
  );
}
