"use client";
import { Star, Clock, AlertTriangle } from "lucide-react";
export type MsgState = "sending"|"sent"|"delivered"|"seen"|"failed";
export function MessageStatus({ state, tone }: { state: MsgState; tone: "mine"|"theirs" }) {
  if (tone !== "mine") return null;
  if (state === "sending") return <Clock className="size-3 opacity-60" aria-label="sending" />;
  if (state === "failed") return <AlertTriangle className="size-3 text-danger" aria-label="failed" />;
  if (state === "delivered") return <Star className="size-3.5 fill-none stroke-current opacity-70" strokeWidth={1.8} aria-label="delivered" />;
  if (state === "seen") return <Star className="size-3.5 fill-amber-400 stroke-amber-400" aria-label="seen" />;
  return <span aria-label="sent" className="text-[0.65rem] font-bold opacity-60">\u2713</span>;
}
