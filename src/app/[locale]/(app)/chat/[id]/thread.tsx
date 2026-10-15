/* eslint-disable @typescript-eslint/no-explicit-any -- realtime payloads are untyped until DB types regenerate */
"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { ArrowLeft, Send, Reply, Pencil, Trash2, Smile, Info, X, Flame } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ThreadMessage } from "@/features/chat/queries";
import type { Receipt, Reaction } from "@/features/chat/types";
import { MessageStatus, type MsgState } from "@/features/chat/components/MessageStatus";
import { ReactionPicker } from "@/features/chat/components/ReactionPicker";
import { MessageInfo } from "@/features/chat/components/MessageInfo";
import { ChatNotification } from "@/features/chat/components/ChatNotification";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";
export type ThreadProps = { conversationId: string; meId: string; initialMessages: ThreadMessage[]; peerName: string; peerUsername: string; peerAvatarUrl: string | null; streak?: number };
type LocalMsg = ThreadMessage & { reply_to_message_id?: string | null; is_edited?: boolean | null; edited_at?: string | null; deleted_for_all?: boolean | null; deleted_for?: string[] | null; _pending?: boolean; _failed?: boolean };
function msgState(m: LocalMsg, meId: string, receipts: Receipt[]): MsgState {
  if (m._pending) return "sending"; if (m._failed) return "failed";
  if (m.sender_id !== meId) return "sent";
  const r = receipts.filter((x) => x.message_id === m.id);
  if (r.some((x) => x.seen_at)) return "seen";
  if (r.some((x) => x.delivered_at)) return "delivered";
  return "sent";
}
export function Thread({ conversationId, meId, initialMessages, peerName, peerUsername, peerAvatarUrl, streak }: ThreadProps) {
  const t = useTranslations("Chat"); const tAuth = useTranslations("Auth.errors"); const format = useFormatter();
  const [messages, setMessages] = useState<LocalMsg[]>(initialMessages as LocalMsg[]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [body, setBody] = useState(""); const [errorKey, setErrorKey] = useState<string|null>(null); const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<LocalMsg|null>(null); const [editing, setEditing] = useState<LocalMsg|null>(null); const [editBody, setEditBody] = useState("");
  const [menuFor, setMenuFor] = useState<string|null>(null); const [pickerFor, setPickerFor] = useState<string|null>(null); const [infoFor, setInfoFor] = useState<LocalMsg|null>(null);
  const [hasNew, setHasNew] = useState(false); const [stuck, setStuck] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null); const scrollRef = useRef<HTMLDivElement>(null); const atBottom = useRef(true);
  const upsert = useCallback((row: LocalMsg) => setMessages((p) => { const i = p.findIndex((m) => m.id === row.id); if (i>=0) { const n=[...p]; n[i]={...n[i],...row}; return n; } return [...p,row].sort((a,b)=>+new Date(a.created_at)-+new Date(b.created_at)); }),[]);
  const markRead = useCallback(async () => { try { const s = createClient() as unknown as any; await s.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", meId); await s.from("message_receipts").upsert(messages.filter((m: any)=>m.sender_id!==meId && !m._pending).map((m: any)=>({ message_id: m.id, user_id: meId, seen_at: new Date().toISOString() })), { onConflict: "message_id,user_id" }); } catch {} }, [conversationId, meId, messages]);
  useEffect(() => {
    const supabase = createClient() as unknown as any; let alive = true;
    (async () => {
      const since = messages.length ? messages[messages.length-1].created_at : new Date(0).toISOString();
      const [{ data: missed }, { data: rc }, { data: rx }] = await Promise.all([
        supabase.from("messages").select("*").eq("conversation_id", conversationId).gt("created_at", since).order("created_at").limit(100),
        supabase.from("message_receipts").select("*").in("message_id", (messages.map((m: any)=>m.id).slice(-100))).limit(500),
        supabase.from("message_reactions").select("*").in("message_id", (messages.map((m: any)=>m.id).slice(-100))).limit(500),
      ]);
      if (!alive) return;
      (missed ?? []).forEach((r: any) => upsert(r as LocalMsg));
      if (rc) setReceipts((p)=>{ const ids=new Set(p.map((x: Receipt)=>x.message_id+x.user_id)); return [...p, ...(rc as Receipt[]).filter((x: Receipt)=>!ids.has(x.message_id+x.user_id))]; });
      if (rx) setReactions((p)=>{ const ids=new Set(p.map((x: Reaction)=>x.message_id+x.user_id)); return [...p, ...(rx as Reaction[]).filter((x: Reaction)=>!ids.has(x.message_id+x.user_id))]; });
      const incom = (missed ?? []).filter((m: any) => (m as {sender_id:string}).sender_id !== meId);
      if (incom.length) {
        await supabase.from("message_receipts").upsert(incom.map((m: any)=>({ message_id: (m as {id:string}).id, user_id: meId, delivered_at: new Date().toISOString() })), { onConflict: "message_id,user_id" });
        void markRead();
      }
    })();
    const ch = supabase.channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (pl: any) => {
        const row = pl.new as LocalMsg; upsert(row);
        if (row.sender_id !== meId) { void supabase.from("message_receipts").upsert({ message_id: row.id, user_id: meId, delivered_at: new Date().toISOString() }, { onConflict: "message_id,user_id" }); void markRead(); if (!atBottom.current) setHasNew(true); }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (pl: any) => upsert(pl.new as LocalMsg))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (pl: any) => { const o = pl.old as {id:string}; setMessages((p)=>p.filter((m: any)=>m.id!==o.id)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_receipts" }, (pl: any) => { const r = (pl.new ?? pl.old) as Receipt; if (!r?.message_id) return; setReceipts((p)=>{ const i=p.findIndex((x)=>x.message_id===r.message_id&&x.user_id===r.user_id); if(i>=0){const n=[...p];n[i]={...n[i],...r};return n;} return [...p,r]; }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (pl: any) => {
        if (pl.eventType === "DELETE") { const o = pl.old as Reaction; setReactions((p)=>p.filter((x)=>!(x.message_id===o.message_id&&x.user_id===o.user_id))); }
        else { const r = pl.new as Reaction; setReactions((p)=>{ const i=p.findIndex((x)=>x.message_id===r.message_id&&x.user_id===r.user_id); if(i>=0){const n=[...p];n[i]=r;return n;} return [...p,r]; }); }
      }).subscribe((st: any) => setStuck(st === "CLOSED" || st === "CHANNEL_ERROR"));
    const onVis = () => { if (document.visibilityState === "visible") void markRead(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, meId]);
  useEffect(() => { if (atBottom.current) bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  const onScroll = () => { const el = scrollRef.current; if (!el) return; const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80; atBottom.current = near; if (near) setHasNew(false); };
  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const trimmed = body.trim(); if (!trimmed || sending) return;
    if (trimmed.length > 2000) { setErrorKey("too_long"); return; }
    setSending(true); setErrorKey(null);
    const tempId = `pending-${Date.now()}`;
    const optimistic: LocalMsg = { id: tempId, conversation_id: conversationId, sender_id: meId, body: trimmed, created_at: new Date().toISOString(), reply_to_message_id: replyTo?.id ?? null, _pending: true } as LocalMsg;
    setMessages((p)=>[...p, optimistic]); setBody(""); setReplyTo(null);
    try {
      const supabase = createClient() as unknown as any;
      const { data, error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: meId, body: trimmed, reply_to_message_id: replyTo?.id ?? null }).select().single();
      setMessages((p)=>p.filter((m: any)=>m.id!==tempId));
      if (error) { const tx = error.message.toLowerCase(); setErrorKey(tx.includes("too_many")?"too_many_attempts":tx.includes("not_authorised")?"not_authorised":"send_failed"); setMessages((p)=>[...p,{...optimistic,_pending:false,_failed:true}]); return; }
      if (data) upsert(data as LocalMsg);
    } catch { setMessages((p)=>p.map((m: any)=>m.id===tempId?{...m,_pending:false,_failed:true}:m)); setErrorKey("send_failed"); }
    finally { setSending(false); }
  }
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) { if (e.key==="Enter"&&!e.shiftKey){e.preventDefault(); e.currentTarget.form?.requestSubmit();} }
  async function react(msgId: string, emoji: string) {
    const s = createClient() as unknown as any; const mine = reactions.find((r)=>r.message_id===msgId&&r.user_id===meId);
    if (mine?.emoji === emoji) await s.from("message_reactions").delete().eq("message_id",msgId).eq("user_id",meId);
    else if (mine) await s.from("message_reactions").update({ emoji }).eq("message_id",msgId).eq("user_id",meId);
    else await s.from("message_reactions").insert({ message_id: msgId, user_id: meId, emoji });
    setPickerFor(null);
  }
  async function saveEdit() {
    if (!editing || !editBody.trim()) return; const s = createClient() as unknown as any;
    const { error } = await s.from("messages").update({ body: editBody.trim(), is_edited: true, edited_at: new Date().toISOString() }).eq("id", editing.id);
    if (!error) { upsert({ ...editing, body: editBody.trim(), is_edited: true } as LocalMsg); setEditing(null); }
  }
  async function del(everyone: boolean) {
    const m = menuFor ? messages.find((x)=>x.id===menuFor) : null; if (!m) return; const s = createClient() as unknown as any;
    if (everyone) await s.from("messages").update({ body: "", deleted_for_all: true, deleted_at: new Date().toISOString() }).eq("id", m.id);
    else { const cur = ((m as {deleted_for?:string[]}).deleted_for ?? []); await s.from("messages").update({ deleted_for: [...cur, meId] }).eq("id", m.id); }
    setMenuFor(null);
  }
  const byId = useMemo(()=>new Map(messages.map((m: any)=>[m.id,m])),[messages]);
  const visible = messages.filter((m: any)=>!((m as {deleted_for?:string[]}).deleted_for ?? []).includes(meId));
  return (
    <Card className="flex h-[calc(100dvh-10rem)] min-h-80 flex-col overflow-hidden p-0">
      <ChatNotification meId={meId} activeConversationId={conversationId} />
      <h1 className="sr-only">{t("threadLabel")}</h1>
      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <Link href="/chat" aria-label={t("backToMessages")} className="-ms-1 flex size-11 shrink-0 items-center justify-center rounded-pill text-muted hover:bg-surface-2 hover:text-brand"><ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" /></Link>
        <Avatar size="sm" name={peerName||undefined} src={peerAvatarUrl} />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{peerName||t("unknownPeer")}</p>{peerUsername?<p className="truncate text-xs text-muted" dir="ltr">@{peerUsername}</p>:null}</div>
        {typeof streak === "number" && streak >= 2 ? (<span title={t("streakDays",{count:streak})} className="flex items-center gap-1 rounded-pill bg-orange-100 px-2 py-1 text-xs font-bold text-orange-600"><Flame className="size-3.5" aria-hidden="true" />{streak}</span>) : null}
      </div>
      {stuck ? (<p className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-800">reconnecting…</p>) : null}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {visible.length===0?<p className="py-8 text-center text-sm text-muted">{t("noMessages")}</p>:null}
        <ul className="flex flex-col gap-2.5">
        {visible.map((m: any)=>{ const mine=m.sender_id===meId; const deleted=!!(m as {deleted_for_all?:boolean}).deleted_for_all; const orig=m.reply_to_message_id?byId.get(m.reply_to_message_id):null; const rxns=reactions.filter((r)=>r.message_id===m.id); const counts=new Map<string,number>(); rxns.forEach((r)=>counts.set(r.emoji,(counts.get(r.emoji)??0)+1));
          return (
          <li key={m.id} id={`msg-${m.id}`} className={mine?"flex justify-end":"flex justify-start"}>
            <div className="relative max-w-[85%]">
              {pickerFor===m.id?<ReactionPicker onPick={(e)=>void react(m.id,e)} onClose={()=>setPickerFor(null)} />:null}
              <div className={mine?"rounded-card bg-brand px-3.5 py-2 text-on-brand":"rounded-card bg-surface-2 px-3.5 py-2 text-text"}>
                {orig&&!deleted?<button type="button" onClick={()=>document.getElementById(`msg-${orig.id}`)?.scrollIntoView({block:"center",behavior:"smooth"})} className="mb-1.5 block w-full border-s-2 border-amber-300 ps-2 text-start opacity-90"><span className="block truncate text-[0.7rem] font-bold">{orig.sender_id===meId?"You":peerName}</span><span className="block truncate text-xs opacity-80" dir="auto">{(orig as {deleted_for_all?:boolean}).deleted_for_all?t("deletedPreview"):orig.body.slice(0,80)}</span></button>:null}
                {editing?.id===m.id?(<span><textarea value={editBody} onChange={(e)=>setEditBody(e.target.value)} rows={2} className="w-full rounded-control bg-white/20 p-1 text-sm" /><span className="mt-1 flex gap-2"><button type="button" onClick={()=>void saveEdit()} className="text-xs font-bold underline">{t("save")}</button><button type="button" onClick={()=>setEditing(null)} className="text-xs underline">{t("cancel")}</button></span></span>)
                : deleted ? (<p className="text-sm italic opacity-70">{t("deletedMessage")}</p>)
                : (<p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed" dir="auto">{m.body}</p>)}
                <span className={`mt-1 flex items-center justify-end gap-1 text-[0.625rem] ${mine?"text-on-brand/75":"text-muted"}`}><time dateTime={m.created_at}>{format.dateTime(new Date(m.created_at),{hour:"numeric",minute:"2-digit"})}</time>{(m as {is_edited?:boolean}).is_edited?<span>· {t("edited")}</span>:null}{mine?<MessageStatus state={msgState(m,meId,receipts)} tone="mine" />:null}</span>
                {counts.size>0?<span className="mt-1 flex flex-wrap gap-1">{[...counts.entries()].map(([e,c])=>(<button key={e} type="button" onClick={()=>setPickerFor(m.id)} className="rounded-pill bg-black/10 px-1.5 py-0.5 text-xs">{e} {c}</button>))}</span>:null}
              </div>
              <span className="mt-0.5 flex gap-1 text-muted">
                <button type="button" aria-label={t("reply")} onClick={()=>setReplyTo(m)} className="rounded p-1 hover:bg-surface-2"><Reply className="size-3.5" /></button>
                <button type="button" aria-label={t("react")} onClick={()=>setPickerFor(pickerFor===m.id?null:m.id)} className="rounded p-1 hover:bg-surface-2"><Smile className="size-3.5" /></button>
                {mine&&!deleted?(<><button type="button" aria-label={t("edit")} onClick={()=>{setEditing(m);setEditBody(m.body);}} className="rounded p-1 hover:bg-surface-2"><Pencil className="size-3.5" /></button><button type="button" aria-label={t("delete")} onClick={()=>setMenuFor(menuFor===m.id?null:m.id)} className="rounded p-1 hover:bg-surface-2"><Trash2 className="size-3.5" /></button><button type="button" aria-label={t("messageInfo")} onClick={()=>setInfoFor(m)} className="rounded p-1 hover:bg-surface-2"><Info className="size-3.5" /></button></>):null}
              </span>
              {menuFor===m.id?(<span className="absolute z-10 flex flex-col gap-1 rounded-card border border-border bg-surface p-1 text-xs shadow-lift"><button type="button" onClick={()=>void del(true)} className="rounded px-2 py-1.5 text-start hover:bg-surface-2">{t("deleteEveryone")}</button><button type="button" onClick={()=>void del(false)} className="rounded px-2 py-1.5 text-start hover:bg-surface-2">{t("deleteMe")}</button></span>):null}
            </div>
          </li>);})}
        </ul>
        <div ref={bottomRef} aria-hidden="true" />
        {hasNew?(<button type="button" onClick={()=>{bottomRef.current?.scrollIntoView();setHasNew(false);}} className="sticky bottom-2 mx-auto block rounded-pill bg-brand px-3 py-1 text-xs font-bold text-on-brand shadow-lift">{t("newMessages")} ↓</button>):null}
      </div>
      <form onSubmit={(e)=>void handleSubmit(e)} className="border-t border-border px-4 py-2.5">
        {replyTo?(<div className="mb-2 flex items-center gap-2 rounded-control border-s-2 border-brand bg-surface-2 px-3 py-1.5 text-xs"><span className="min-w-0 flex-1 truncate" dir="auto"><b>{replyTo.sender_id===meId?"You":peerName}:</b> {replyTo.body.slice(0,80)}</span><button type="button" aria-label={t("cancel")} onClick={()=>setReplyTo(null)}><X className="size-4" /></button></div>):null}
        {errorKey?(<p role="alert" className="mb-2 text-sm text-danger">{errorKey==="too_long"?t("errors.too_long"):t("errors.send_failed")}</p>):null}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-message" className="sr-only">{t("composerLabel")}</label>
          <textarea id="chat-message" rows={1} value={body} onChange={(e)=>setBody(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("composerPlaceholder")} maxLength={2000} className="max-h-32 min-h-11 flex-1 resize-none rounded-control border border-border bg-surface-2 px-3 py-2.5 text-[0.9375rem]" />
          <Button type="submit" isLoading={sending} loadingLabel={t("sending")} disabled={!body.trim()} aria-label={t("send")}><Send className="size-4 rtl:-scale-x-100" aria-hidden="true" /><span className="hidden sm:inline">{t("send")}</span></Button>
        </div>
      </form>
      {infoFor ? (
        <MessageInfo open={!!infoFor} onClose={() => setInfoFor(null)} body={infoFor.body} sentAt={infoFor.created_at}
          deliveredAt={receipts.find((x) => x.message_id === infoFor.id && x.delivered_at)?.delivered_at ?? null}
          seenAt={receipts.find((x) => x.message_id === infoFor.id && x.seen_at)?.seen_at ?? null} />
      ) : null}
    </Card>
  );
}
