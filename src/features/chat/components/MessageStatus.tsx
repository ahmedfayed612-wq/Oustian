"use client";
import { Check, CheckCheck, Clock, AlertTriangle } from "lucide-react";

export type MsgState = "sending" | "sent" | "delivered" | "seen" | "failed";

/**
 * WhatsApp-style delivery ticks for own messages.
 * single tick = sent, double tick = delivered, blue double tick = seen.
 */
export function MessageStatus({ state, tone }: { state: MsgState; tone: "mine" | "theirs" }) {
  if (tone !== "mine") return null;
  if (state === "sending")
    return <Clock className="size-3 shrink-0 opacity-60" aria-label="sending" />;
  if (state === "failed")
    return <AlertTriangle className="size-3 shrink-0 text-red-300" aria-label="failed" />;
  if (state === "seen")
    return <CheckCheck className="size-4 shrink-0 text-sky-300" strokeWidth={2.2} aria-label="seen" />;
  if (state === "delivered")
    return <CheckCheck className="size-4 shrink-0 opacity-70" strokeWidth={2} aria-label="delivered" />;
  return <Check className="size-3.5 shrink-0 opacity-60" strokeWidth={2} aria-label="sent" />;
}
