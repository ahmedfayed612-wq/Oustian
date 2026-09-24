"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import type { ThreadMessage } from "@/features/chat/queries";
import { Link } from "@/i18n/navigation";
import { createClient } from "@/lib/supabase/client";

export type ThreadProps = {
  conversationId: string;
  meId: string;
  initialMessages: ThreadMessage[];
  peerName: string;
  peerUsername: string;
  peerAvatarUrl: string | null;
};

/**
 * The open conversation. Incoming messages arrive over Supabase Realtime
 * straight from the browser (Vercel hosts no socket server); sends are
 * RLS-checked inserts. Everything dedupes by id, so the optimistic echo and
 * the realtime event can never double-render a message.
 */
export function Thread({
  conversationId,
  meId,
  initialMessages,
  peerName,
  peerUsername,
  peerAvatarUrl,
}: ThreadProps) {
  const t = useTranslations("Chat");
  const tAuth = useTranslations("Auth.errors");
  const format = useFormatter();

  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages);
  const [body, setBody] = useState("");
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as ThreadMessage;

          setMessages((prev) =>
            prev.some((message) => message.id === row.id)
              ? prev
              : [...prev, row],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.old as { id: string };

          setMessages((prev) =>
            prev.filter((message) => message.id !== row.id),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = body.trim();

    if (!trimmed || sending) return;

    if (trimmed.length > 2000) {
      setErrorKey("too_long");
      return;
    }

    setSending(true);
    setErrorKey(null);

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId,
          sender_id: meId,
          body: trimmed,
        })
        .select()
        .single();

      if (error) {
        const text = error.message.toLowerCase();

        if (text.includes("too_many_attempts")) {
          setErrorKey("too_many_attempts");
        } else if (text.includes("not_authorised")) {
          setErrorKey("not_authorised");
        } else if (
          text.includes("messages_body_check") ||
          text.includes("23514")
        ) {
          setErrorKey("too_long");
        } else {
          setErrorKey("send_failed");
        }

        return;
      }

      if (data) {
        setMessages((prev) =>
          prev.some((message) => message.id === data.id)
            ? prev
            : [...prev, data],
        );
      }

      setBody("");
    } catch {
      setErrorKey("send_failed");
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  function errorText(key: string): string {
    switch (key) {
      case "too_many_attempts":
        return tAuth("too_many_attempts");
      case "not_authorised":
        return tAuth("not_authorised");
      case "empty":
        return t("errors.empty");
      case "too_long":
        return t("errors.too_long");
      case "invalid_conversation":
        return t("errors.invalid_conversation");
      default:
        return t("errors.send_failed");
    }
  }

  return (
    <Card className="flex h-[calc(100dvh-10rem)] min-h-80 flex-col overflow-hidden p-0">
      <h1 className="sr-only">{t("threadLabel")}</h1>

      <div className="flex items-center gap-3 border-b border-border px-4 py-2.5">
        <Link
          href="/chat"
          aria-label={t("backToMessages")}
          className="-ms-1 flex size-11 shrink-0 items-center justify-center rounded-pill text-muted transition-colors hover:bg-surface-2 hover:text-brand"
        >
          <ArrowLeft className="size-5 rtl:-scale-x-100" aria-hidden="true" />
        </Link>
        <Avatar size="sm" name={peerName || undefined} src={peerAvatarUrl} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">
            {peerName || t("unknownPeer")}
          </p>
          {peerUsername ? (
            <p className="truncate text-xs text-muted" dir="ltr">
              @{peerUsername}
            </p>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {messages.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">
            {t("noMessages")}
          </p>
        ) : null}

        <ul className="flex flex-col gap-2.5">
          {messages.map((message) => {
            const mine = message.sender_id === meId;

            return (
              <li
                key={message.id}
                className={mine ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    mine
                      ? "max-w-[85%] rounded-card bg-brand px-3.5 py-2 text-on-brand"
                      : "max-w-[85%] rounded-card bg-surface-2 px-3.5 py-2 text-text"
                  }
                >
                  <p
                    className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap"
                    dir="auto"
                  >
                    {message.body}
                  </p>
                  <time
                    dateTime={message.created_at}
                    className={`mt-1 block text-end text-[0.625rem] ${
                      mine ? "text-on-brand/75" : "text-muted"
                    }`}
                  >
                    {format.dateTime(new Date(message.created_at), {
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </time>
                </div>
              </li>
            );
          })}
        </ul>

        <div ref={bottomRef} aria-hidden="true" />
      </div>

      <form
        onSubmit={handleSubmit}
        className="border-t border-border px-4 py-2.5"
      >
        {errorKey ? (
          <p role="alert" className="mb-2 text-sm text-danger">
            {errorText(errorKey)}
          </p>
        ) : null}

        <div className="flex items-end gap-2">
          <label htmlFor="chat-message" className="sr-only">
            {t("composerLabel")}
          </label>
          <textarea
            id="chat-message"
            rows={1}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("composerPlaceholder")}
            maxLength={2000}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-control border border-border bg-surface-2 px-3 py-2.5 text-[0.9375rem] text-text transition-colors placeholder:text-muted focus:border-brand focus:outline-none"
          />
          <Button
            type="submit"
            isLoading={sending}
            loadingLabel={t("sending")}
            disabled={!body.trim()}
            aria-label={t("send")}
          >
            <Send className="size-4 rtl:-scale-x-100" aria-hidden="true" />
            <span className="hidden sm:inline">{t("send")}</span>
          </Button>
        </div>
      </form>
    </Card>
  );
}
