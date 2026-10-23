/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
import { AVATAR_BUCKET } from "@/lib/supabase/storage";
import { Avatar } from "@/components/ui/Avatar";
type Toast = { id: string; senderName: string; preview: string; conversationId: string; avatar: string | null };
export function ChatNotification({ meId, activeConversationId }: { meId: string; activeConversationId?: string | null }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    if (!meId) return;
    const supabase = createClient() as unknown as any;
    let alive = true;
    const ch = supabase.channel(`notify:${meId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `recipient_id=eq.${meId}` }, async (payload: any) => {
        try {
          const row = payload.new as { id: string; type: string; conversation_id: string | null; message_id: string | null; actor_id: string | null };
          if (!row || row.type !== "chat_message" || !row.conversation_id || !row.message_id) return;
          if (row.conversation_id === activeConversationId) return;
          if (!alive) return;
          const [{ data: msg }, { data: prof }] = await Promise.all([
            supabase.from("messages").select("body").eq("id", row.message_id ?? "").maybeSingle(),
            row.actor_id ? supabase.from("profiles").select("full_name,avatar_path").eq("id", row.actor_id).maybeSingle() : Promise.resolve({ data: null }),
          ]);
          if (!alive) return;
          const body = ((msg as { body?: string } | null)?.body ?? "").slice(0, 80);
          if (!body) return;
          const actor = prof as { full_name?: string; avatar_path?: string | null } | null;
          const t: Toast = {
            id: row.id,
            senderName: actor?.full_name ?? "Oustians",
            preview: body,
            conversationId: row.conversation_id,
            avatar: null,
          };
          // Sign the sender's private avatar so the toast can render a photo on
          // private buckets (avatars are not public — the path alone is not enough).
          if (actor?.avatar_path) {
            const client = createClient() as unknown as any;
            const { data } = await client.storage.from(AVATAR_BUCKET).createSignedUrl(actor.avatar_path, 600);
            if (data?.signedUrl) t.avatar = data.signedUrl;
          }
          setToasts((p) => (p.some((x) => x.id === t.id) ? p : [...p.slice(-2), t]));
          window.setTimeout(() => { if (alive) setToasts((p) => p.filter((x) => x.id !== t.id)); }, 6000);
        } catch { /* toast is best-effort */ }
      }).subscribe();
    return () => { alive = false; void supabase.removeChannel(ch); };
  }, [meId, activeConversationId]);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed start-3 top-16 z-50 flex w-72 flex-col gap-2" role="status" aria-live="polite">
      {toasts.map((t) => (
        <Link key={t.id} href={`/chat/${t.conversationId}`} className="pointer-events-auto flex items-center gap-2 rounded-card border border-border bg-surface p-2.5 shadow-lift">
          <Avatar size="sm" name={t.senderName} src={t.avatar} />
          <span className="min-w-0"><span className="block truncate text-sm font-semibold">{t.senderName}</span><span className="block truncate text-xs text-muted" dir="auto">{t.preview}</span></span>
        </Link>
      ))}
    </div>
  );
}
