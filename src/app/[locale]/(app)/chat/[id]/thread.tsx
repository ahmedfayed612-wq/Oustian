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
  const t = useTranslations("Chat"); const format = useFormatter();
  const [messages, setMessages] = useState<LocalMsg[]>(initialMessages as LocalMsg[]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [body, setBody] = useState(""); const [errorKey, setErrorKey] = useState<string|null>(null); const [sending, setSending] = useState(false);
  const [replyTo, setReplyTo] = useState<LocalMsg|null>(null); const [editing, setEditing] = useState<LocalMsg|null>(null); const [editBody, setEditBody] = useState("");
  const [menuFor, setMenuFor] = useState<string|null>(null); const [pickerFor, setPickerFor] = useState<string|null>(null); const [infoFor, setInfoFor] = useState<LocalMsg|null>(null);
  const [hasNew, setHasNew] = useState(false); const [stuck, setStuck] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null); const scrollRef = useRef<HTMLDivElement>(null); const atBottom = useRef(true);
  const upsert = useCallback((row: LocalMsg) => setMessages((p) => { const i = p.findIndex((m) => m.id === row.id); if (i>=0) { const n=[...p]; n[i]={...n[i],...row}; return n; } const n=[...p,row].sort((a,b)=>+new Date(a.created_at)-+new Date(b.created_at)); return n.length > 300 ? n.slice(n.length - 300) : n; }),[]);
  const knownIds = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const rememberIds = useCallback((rows: LocalMsg[]) => { for (const r of rows) { knownIds.current.add(r.id); if (knownIds.current.size > 400) { const first = knownIds.current.values().next(); if (!first.done) knownIds.current.delete(first.value); } } }, []);
  const markRead = useCallback(async () => { try { const s = createClient() as unknown as any; await s.from("conversation_members").update({ last_read_at: new Date().toISOString() }).eq("conversation_id", conversationId).eq("user_id", meId); const seenSet = new Set(receipts.filter((r) => r.user_id === meId && r.seen_at).map((r) => r.message_id)); const unseen = messages.filter((m: any)=>m.sender_id!==meId && !m._pending && !String(m.id).startsWith("pending-") && !seenSet.has(m.id)); if (unseen.length) await s.from("message_receipts").upsert(unseen.map((m: any)=>({ message_id: m.id, user_id: meId, seen_at: new Date().toISOString() })), { onConflict: "message_id,user_id" }); } catch {} }, [conversationId, meId, messages, receipts]);
  // Live handlers must call the LATEST markRead — a mount-time closure would
  // keep upserting the initial snapshot and never mark newer messages seen.
  const markReadRef = useRef(markRead);
  useEffect(() => { markReadRef.current = markRead; });
  useEffect(() => {
    const supabase = createClient() as unknown as any; let alive = true;
    (async () => {
      try {
        const since = messages.length ? messages[messages.length-1].created_at : new Date(0).toISOString();
        const ids = messages.map((m: any)=>m.id).slice(-100).filter((id: string) => id && !String(id).startsWith("pending-"));
        const [missedRes, rcRes, rxRes] = await Promise.all([
          supabase.from("messages").select("*").eq("conversation_id", conversationId).gt("created_at", since).order("created_at").limit(100),
          ids.length ? supabase.from("message_receipts").select("*").in("message_id", ids).limit(500) : Promise.resolve({ data: [] }),
          ids.length ? supabase.from("message_reactions").select("*").in("message_id", ids).limit(500) : Promise.resolve({ data: [] }),
        ]);
        if (!alive) return;
        const missed = (missedRes.data ?? []) as LocalMsg[];
        const fresh = missed.filter((r) => !knownIds.current.has(r.id));
        if (fresh.length) { rememberIds(fresh); fresh.forEach((r) => upsert(r)); }
        const rc = rcRes.data as Receipt[] | null; const rx = rxRes.data as Reaction[] | null;
        if (rc) setReceipts((p)=>{ const ids2=new Set(p.map((x: Receipt)=>x.message_id+x.user_id)); const add=(rc as Receipt[]).filter((x: Receipt)=>!ids2.has(x.message_id+x.user_id)); return add.length ? [...p, ...add].slice(-500) : p; });
        if (rx) setReactions((p)=>{ const ids2=new Set(p.map((x: Reaction)=>x.message_id+x.user_id)); const add=(rx as Reaction[]).filter((x: Reaction)=>!ids2.has(x.message_id+x.user_id)); return add.length ? [...p, ...add].slice(-500) : p; });
      // On OPEN: deliver everything incoming and mark it seen. `fresh` only
      // holds messages newer than the last one we already have — empty on a
      // fresh visit — so without this block receipts never write and the peer
      // never sees "seen".
      const incoming = messages.filter((m: any) => m.sender_id !== meId && !m._pending && !String(m.id).startsWith("pending-") && knownIds.current.has(m.id));
      const deliveredSet = new Set((rc ?? []).filter((r: Receipt) => r.user_id === meId && r.delivered_at).map((r: Receipt) => r.message_id));
      const toDeliver = incoming.filter((m: any) => !deliveredSet.has((m as {id:string}).id));
      if (toDeliver.length) {
        try {
          await supabase.from("message_receipts").upsert(toDeliver.map((m: any)=>({ message_id: (m as {id:string}).id, user_id: meId, delivered_at: new Date().toISOString() })), { onConflict: "message_id,user_id" });
        } catch {}
      }
      void markReadRef.current();
      } catch {}
    })();
    const ch = supabase.channel(`messages:${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (pl: any) => {
        const row = pl.new as LocalMsg;
        if (knownIds.current.has(row.id)) { upsert(row); return; }
        rememberIds([row]); upsert(row);
        // Coalesce our own echo: drop the optimistic pending bubble if it matches.
        if (row.sender_id === meId) {
          setMessages((p) => {
            const pend = p.find((m: any) => m._pending && m.sender_id === meId && (m as {body:string}).body === row.body);
            if (!pend) return p;
            return p.filter((m: any) => m.id !== (pend as {id:string}).id);
          });
        }
        if (row.sender_id !== meId) { void supabase.from("message_receipts").upsert({ message_id: row.id, user_id: meId, delivered_at: new Date().toISOString() }, { onConflict: "message_id,user_id" }); void markReadRef.current(); if (!atBottom.current) setHasNew(true); }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (pl: any) => upsert(pl.new as LocalMsg))
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` }, (pl: any) => { const o = pl.old as {id:string}; setMessages((p)=>p.filter((m: any)=>m.id!==o.id)); })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_receipts" }, (pl: any) => { const r = (pl.new ?? pl.old) as Receipt; if (!r?.message_id || !knownIds.current.has(r.message_id)) return; setReceipts((p)=>{ const i=p.findIndex((x)=>x.message_id===r.message_id&&x.user_id===r.user_id); if(i>=0){const n=[...p];n[i]={...n[i],...r};return n;} return [...p,r].slice(-500); }); })
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, (pl: any) => {
        if (pl.eventType === "DELETE") { const o = pl.old as Reaction; setReactions((p)=>p.filter((x)=>!(x.message_id===o.message_id&&x.user_id===o.user_id))); }
        else { const r = pl.new as Reaction; if (!r?.message_id || !knownIds.current.has(r.message_id)) return; setReactions((p)=>{ const i=p.findIndex((x)=>x.message_id===r.message_id&&x.user_id===r.user_id); if(i>=0){const n=[...p];n[i]=r;return n;} return [...p,r].slice(-500); }); }
      }).subscribe((st: any) => setStuck(st === "CLOSED" || st === "CHANNEL_ERROR"));
    const onVis = () => { if (document.visibilityState === "visible") void markReadRef.current(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { alive = false; document.removeEventListener("visibilitychange", onVis); void supabase.removeChannel(ch); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, meId]);
  useEffect(() => { if (atBottom.current) bottomRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  useEffect(() => {
    if (!menuFor) return;
    const onDown = (e: PointerEvent) => {
      const el = (e.target as HTMLElement).closest("[data-msg-menu]");
      if (!el) setMenuFor(null);
    };
    const onKey = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") { setMenuFor(null); setPickerFor(null); } };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [menuFor]);
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
      <h1 className="sr-only">{t("threadLabel")}</h1>
      <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-2.5">
        <Link href="/chat" aria-label={t("backToMessages")} className="-ms-1 flex size-11 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-surface-2 hover:text-brand"><ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" /></Link>
        <Avatar size="sm" name={peerName||undefined} src={peerAvatarUrl} />
        <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{peerName||t("unknownPeer")}</p>{peerUsername?<p className="truncate text-xs text-muted" dir="ltr">@{peerUsername}</p>:null}</div>
        {typeof streak === "number" && streak >= 1 ? (<span title={t("streakDays",{count:streak})} className="flex items-center gap-1 rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-600 dark:bg-orange-500/15 dark:text-orange-400"><Flame className="size-3.5" aria-hidden="true" />{streak}</span>) : null}
      </div>
      {stuck ? (<p className="bg-amber-100 px-4 py-1 text-center text-xs text-amber-800">reconnecting…</p>) : null}
      <div ref={scrollRef} onScroll={onScroll} className="relative min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-surface-2/40 px-3 py-3 sm:px-4">
        {visible.length===0?<p className="py-8 text-center text-sm text-muted">{t("noMessages")}</p>:null}
        <ul className="flex flex-col gap-1.5">
        {visible.map((m: any)=>{ const mine=m.sender_id===meId; const deleted=!!(m as {deleted_for_all?:boolean}).deleted_for_all; const orig=m.reply_to_message_id?byId.get(m.reply_to_message_id):null; const rxns=reactions.filter((r)=>r.message_id===m.id); const counts=new Map<string,number>(); rxns.forEach((r)=>counts.set(r.emoji,(counts.get(r.emoji)??0)+1));
          const failed=(m as {_failed?:boolean})._failed; const pending=(m as {_pending?:boolean})._pending;
          return (
          <li key={m.id} id={`msg-${m.id}`} className={mine?"group flex justify-end":"group flex justify-start"}>
            <div className={mine?"relative max-w-[82%] sm:max-w-[75%]":"relative max-w-[82%] sm:max-w-[75%]"}>
              {pickerFor===m.id?<ReactionPicker align={mine?"end":"start"} onPick={(e)=>void react(m.id,e)} onClose={()=>setPickerFor(null)} />:null}
              <div className={mine?"rounded-2xl rounded-br-md bg-brand px-3.5 py-2 text-on-brand shadow-sm":"rounded-2xl rounded-bl-md border border-border/60 bg-surface px-3.5 py-2 text-text shadow-sm"}>
                {orig&&!deleted?<button type="button" onClick={()=>document.getElementById(`msg-${orig.id}`)?.scrollIntoView({block:"center",behavior:"smooth"})} className={mine?"mb-1.5 block w-full rounded-lg border-s-[3px] border-amber-300 bg-black/15 px-2 py-1 text-start":"mb-1.5 block w-full rounded-lg border-s-[3px] border-brand bg-brand/10 px-2 py-1 text-start"}><span className="block truncate text-[0.7rem] font-bold">{orig.sender_id===meId?"You":peerName}</span><span className="block truncate text-xs opacity-80" dir="auto">{(orig as {deleted_for_all?:boolean}).deleted_for_all?t("deletedPreview"):orig.body.slice(0,80)}</span></button>:null}
                {editing?.id===m.id?(<span><textarea value={editBody} onChange={(e)=>setEditBody(e.target.value)} rows={2} className="w-full rounded-lg bg-black/15 p-2 text-sm outline-none" /><span className="mt-1.5 flex gap-3"><button type="button" onClick={()=>void saveEdit()} className="text-xs font-bold underline underline-offset-2">{t("save")}</button><button type="button" onClick={()=>setEditing(null)} className="text-xs underline underline-offset-2 opacity-80">{t("cancel")}</button></span></span>)
                : deleted ? (<p className="text-sm italic opacity-70">{t("deletedMessage")}</p>)
                : (<p className="whitespace-pre-wrap break-words text-[0.9375rem] leading-relaxed" dir="auto">{m.body}</p>)}
                <span className={mine?"mt-1 flex items-center justify-end gap-1 text-[0.65rem] font-medium text-on-brand/80":"mt-1 flex items-center justify-end gap-1 text-[0.65rem] font-medium text-muted"}><time dateTime={m.created_at}>{format.dateTime(new Date(m.created_at),{hour:"numeric",minute:"2-digit"})}</time>{(m as {is_edited?:boolean}).is_edited?<span>· {t("edited")}</span>:null}{mine?<MessageStatus state={msgState(m,meId,receipts)} tone="mine" />:null}</span>
                {counts.size>0?<span className="-mb-1 mt-1.5 flex flex-wrap gap-1">{[...counts.entries()].map(([e,c])=>(<button key={e} type="button" onClick={()=>setPickerFor(m.id)} className={mine?"flex items-center gap-0.5 rounded-full bg-black/20 px-2 py-0.5 text-xs leading-none":"flex items-center gap-0.5 rounded-full border border-border/70 bg-surface-2 px-2 py-0.5 text-xs leading-none shadow-sm"}>{e} <span className="font-semibold">{c}</span></button>))}</span>:null}
              </div>
              <span className="mt-0.5 flex gap-0.5 text-muted" data-msg-menu>
                <button type="button" aria-label={t("reply")} onClick={()=>{setMenuFor(null);setPickerFor(null);setReplyTo(m);}} className="rounded-full p-1.5 transition-colors hover:bg-surface-2 hover:text-text"><Reply className="size-4" /></button>
                <button type="button" aria-label={t("react")} aria-expanded={pickerFor===m.id} onClick={()=>{setMenuFor(null);setPickerFor(pickerFor===m.id?null:m.id);}} className={pickerFor===m.id?"rounded-full bg-surface-2 p-1.5 text-brand shadow-sm":"rounded-full p-1.5 transition-colors hover:bg-surface-2 hover:text-text"}><Smile className="size-4" /></button>
                {mine&&!deleted?(<>
                  <button type="button" aria-label={t("edit")} onClick={()=>{setMenuFor(null);setPickerFor(null);setEditing(m);setEditBody(m.body);}} className="rounded-full p-1.5 transition-colors hover:bg-surface-2 hover:text-text"><Pencil className="size-4" /></button>
                  <button type="button" aria-label={t("messageInfo")} onClick={()=>{setMenuFor(null);setPickerFor(null);setInfoFor(m);}} className="rounded-full p-1.5 transition-colors hover:bg-surface-2 hover:text-text"><Info className="size-4" /></button>
                  <button type="button" aria-label={t("delete")} aria-expanded={menuFor===m.id} onClick={()=>{setPickerFor(null);setMenuFor(menuFor===m.id?null:m.id);}} className={menuFor===m.id?"rounded-full bg-surface-2 p-1.5 text-danger shadow-sm":"rounded-full p-1.5 transition-colors hover:bg-red-500/10 hover:text-danger"}><Trash2 className="size-4" /></button>
                </>):null}
              </span>
              {failed?(<p className="mt-0.5 text-end text-[0.7rem] font-medium text-danger">{t("errors.send_failed")}</p>):null}
              {pending&&!failed?(<p className="mt-0.5 text-end text-[0.7rem] text-muted">{t("sending")}…</p>):null}
              {menuFor===m.id?(<span data-msg-menu className={mine?"absolute end-0 top-full z-20 mt-1 flex min-w-40 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1 text-xs shadow-lift":"absolute start-0 top-full z-20 mt-1 flex min-w-40 flex-col gap-0.5 rounded-xl border border-border bg-surface p-1 text-xs shadow-lift"}><button type="button" onClick={()=>void del(true)} className="rounded-lg px-3 py-2 text-start transition-colors hover:bg-surface-2">{t("deleteEveryone")}</button><button type="button" onClick={()=>void del(false)} className="rounded-lg px-3 py-2 text-start transition-colors hover:bg-surface-2">{t("deleteMe")}</button></span>):null}
            </div>
          </li>);})}
        </ul>
        <div ref={bottomRef} aria-hidden="true" />
        {hasNew?(<button type="button" onClick={()=>{bottomRef.current?.scrollIntoView();setHasNew(false);}} className="sticky bottom-2 mx-auto block rounded-full bg-brand px-4 py-1.5 text-xs font-bold text-on-brand shadow-lift">↓ {t("newMessages")}</button>):null}
      </div>
      <form onSubmit={(e)=>void handleSubmit(e)} className="border-t border-border bg-surface px-3 py-2.5 sm:px-4">
        {replyTo?(<div className="mb-2 flex items-center gap-2 rounded-xl border-s-[3px] border-brand bg-surface-2 px-3 py-1.5 text-xs"><span className="min-w-0 flex-1 truncate" dir="auto"><b>{replyTo.sender_id===meId?"You":peerName}:</b> {replyTo.body.slice(0,80)}</span><button type="button" aria-label={t("cancel")} onClick={()=>setReplyTo(null)} className="rounded-full p-1 hover:bg-border/50"><X className="size-4" /></button></div>):null}
        {errorKey?(<p role="alert" className="mb-2 rounded-lg bg-red-500/10 px-3 py-1.5 text-sm font-medium text-danger">{errorKey==="too_long"?t("errors.too_long"):t("errors.send_failed")}</p>):null}
        <div className="flex items-end gap-2">
          <label htmlFor="chat-message" className="sr-only">{t("composerLabel")}</label>
          <textarea id="chat-message" rows={1} value={body} onChange={(e)=>setBody(e.target.value)} onKeyDown={handleKeyDown} placeholder={t("composerPlaceholder")} maxLength={2000} className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-border bg-surface-2 px-4 py-2.5 text-[0.9375rem] outline-none transition-colors placeholder:text-muted/70 focus:border-brand" />
          <Button type="submit" isLoading={sending} loadingLabel={t("sending")} disabled={!body.trim()} aria-label={t("send")} className="size-11 shrink-0 !rounded-full !px-0"><Send className="size-4 rtl:-scale-x-100" aria-hidden="true" /><span className="hidden">{t("send")}</span></Button>
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
