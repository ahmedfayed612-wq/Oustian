"use client";
import { Check, Star, Clock, AlertTriangle } from "lucide-react";

export type MsgState = "sending" | "sent" | "delivered" | "seen" | "failed";

/**
 * Delivery states for own messages: sent = tick, delivered = hollow star,
 * seen = gold star (the original design). Clock while sending, alert on fail.
 */
export function MessageStatus({ state, tone }: { state: MsgState; tone: "mine" | "theirs" }) {
  if (tone !== "mine") return null;
  if (state === "sending")
    return <Clock className="size-3 shrink-0 opacity-60" aria-label="sending" />;
  if (state === "failed")
    return <AlertTriangle className="size-3 shrink-0 text-red-300" aria-label="failed" />;
  if (state === "seen")
    return <Star className="size-3.5 shrink-0 fill-amber-400 stroke-amber-400" strokeWidth={1.8} aria-label="seen" />;
  if (state === "delivered")
    return <Star className="size-3.5 shrink-0 stroke-current opacity-70" strokeWidth={1.8} aria-label="delivered" />;
  return <Check className="size-3.5 shrink-0 opacity-60" strokeWidth={2} aria-label="sent" />;
}
