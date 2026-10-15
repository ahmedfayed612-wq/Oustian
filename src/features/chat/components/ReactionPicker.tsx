"use client";
import { REACTION_SET } from "../types";
export function ReactionPicker({ onPick, onClose }: { onPick: (e: string) => void; onClose: () => void }) {
  return (
    <div role="dialog" aria-label="reactions" className="absolute -top-11 start-0 z-20 flex gap-0.5 rounded-pill border border-border bg-surface px-1.5 py-1 shadow-lift">
      {REACTION_SET.map((e) => (
        <button key={e} type="button" aria-label={`react ${e}`} onClick={() => { onPick(e); onClose(); }} className="flex size-9 items-center justify-center rounded-pill text-lg transition-transform hover:scale-125">{e}</button>
      ))}
    </div>
  );
}
