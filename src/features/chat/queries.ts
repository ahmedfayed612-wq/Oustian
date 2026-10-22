import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

/**
 * Read helpers for the chat screens. They run on the server during the RSC
 * render; live updates afterwards come from Supabase Realtime in the browser
 * (see `thread.tsx`) — Vercel hosts no socket server.
 */

export type ChatPreview = {
  conversationId: string;
  lastMessageBody: string | null;
  lastMessageAt: string;
  lastMessageSenderId: string | null;
  unreadCount: number;
  peer: {
    id: string;
    username: string;
    fullName: string;
    avatarPath: string | null;
  } | null;
};

export type ThreadMessage = Tables<"messages">;

export type ThreadPeer = {
  id: string;
  username: string;
  fullName: string;
  avatarPath: string | null;
};

/** Canonical UUID check shared by the thread page and the chat actions. */
export const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Inbox rows from the `list_conversation_previews()` RPC, mapped to app shapes. */
export async function listChatPreviews(
  supabase: SupabaseClient<Database>,
): Promise<ChatPreview[]> {
  const { data, error } = await supabase.rpc("list_conversation_previews");

  if (error) {
    console.error("[chat] list_conversation_previews failed", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    conversationId: row.conversation_id,
    lastMessageBody: row.last_message_body,
    lastMessageAt: row.last_message_at,
    lastMessageSenderId: row.last_message_sender,
    unreadCount: row.unread_count,
    peer: row.other_id
      ? {
          id: row.other_id,
          username: row.other_username ?? "",
          fullName: row.other_full_name ?? row.other_username ?? "",
          avatarPath: row.other_avatar_path,
        }
      : null,
  }));
}

/**
 * Loads one thread: membership first (RLS already guarantees we only see our
 * own threads, this check gives the page a clean 404), then the peer profile
 * and up to 200 messages. A peer hidden by RLS (suspended account) comes back
 * with an empty profile — the thread still renders with a placeholder name.
 */
export async function loadThread(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  viewerId: string,
  { limit = 50 }: { limit?: number } = {},
): Promise<{
  messages: ThreadMessage[];
  peer: ThreadPeer | null;
  isMember: boolean;
  /** created_at of the oldest message on this page, for older-page cursors. */
  oldestCreatedAt: string | null;
}> {
  const { data: members, error: membersError } = await supabase
    .from("conversation_members")
    .select("user_id")
    .eq("conversation_id", conversationId);

  if (membersError) {
    console.error("[chat] membership read failed", membersError.message);
    return { messages: [], peer: null, isMember: false, oldestCreatedAt: null };
  }

  const isMember = (members ?? []).some((row) => row.user_id === viewerId);

  if (!isMember) return { messages: [], peer: null, isMember: false, oldestCreatedAt: null };

  const peerId = (members ?? []).find(
    (row) => row.user_id !== viewerId,
  )?.user_id;

  // Newest-first so the tail of the page is the oldest message we show; the
  // client uses its created_at/id as the "older" cursor for scroll-up loads.
  const [messagesResult, peerResult] = await Promise.all([
    supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit + 1), // +1 to detect whether an older page exists
    peerId
      ? supabase
          .from("profiles")
          .select("id, username, full_name, avatar_path")
          .eq("id", peerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (messagesResult.error) {
    console.error("[chat] messages read failed", messagesResult.error.message);
  }

  const rows = messagesResult.data ?? [];
  const hasOlder = rows.length > limit;
  const page = hasOlder ? rows.slice(1) : rows;
  // page is newest-first; reverse so the UI renders oldest-first.
  page.reverse();

  const peer = peerId
    ? {
        id: peerId,
        username: peerResult.data?.username ?? "",
        fullName: peerResult.data?.full_name ?? "",
        avatarPath: peerResult.data?.avatar_path ?? null,
      }
    : null;

  return {
    messages: page,
    isMember: true,
    peer,
    oldestCreatedAt: page.length ? page[0].created_at : null,
  };
}

/**
 * Loads an older page of messages before the given cursor, used when the user
 * scrolls up through history. The cursor is the `created_at` of the oldest
 * message currently shown; ties are broken by `id` so pagination never skips
 * or duplicates a message sharing the same timestamp.
 *
 * Returns rows oldest-first (reversed from the query's newest-first order) so
 * callers can prepend them to the existing message list.
 */
export async function listMessagesBefore(
  supabase: SupabaseClient<Database>,
  conversationId: string,
  { cursor, limit = 50 }: { cursor: string; limit?: number },
): Promise<ThreadMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .lt("created_at", cursor)
    .limit(limit + 1);

  if (error) {
    console.error("[chat] listMessagesBefore failed", error.message);
    return [];
  }

  const rows = data ?? [];
  rows.reverse(); // oldest-first for prepending
  return rows;
}
