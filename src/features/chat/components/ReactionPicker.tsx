"use client";
import { useEffect, useRef } from "react";
import { REACTION_SET } from "../types";

export function ReactionPicker({ onPick, onClose, align = "start" }: { onPick: (e: string) => void; onClose: () => void; align?: "start" | "end" }) {
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside tap / Escape so the bar never gets stuck open.
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="reactions"
      className={"absolute -top-14 z-30 flex items-center gap-0.5 rounded-full border border-border bg-surface px-2 py-1.5 shadow-lift " + (align === "end" ? "end-0" : "start-0")}
    >
      {REACTION_SET.map((e) => (
        <button
          key={e}
          type="button"
          aria-label={`react ${e}`}
          onClick={() => { onPick(e); onClose(); }}
          className="flex size-10 items-center justify-center rounded-full text-[1.35rem] leading-none transition-transform duration-100 hover:scale-[1.3] active:scale-110"
        >
          {e}
        </button>
      ))}
    </div>
  );
}
