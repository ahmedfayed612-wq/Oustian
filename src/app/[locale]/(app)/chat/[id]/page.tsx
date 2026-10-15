import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrl } from "@/lib/supabase/storage";
import { markConversationReadAction } from "@/features/chat/actions";
import { loadThread, uuidPattern } from "@/features/chat/queries";
import { getConversationStreak } from "@/features/chat/streaks";
import { requireApprovedMember } from "@/features/auth/session";
import { Thread } from "./thread";

/**
 * One conversation. `loadThread()` proves membership (RLS enforces it too —
 * this just turns "no access" into a real 404), opening the thread advances
 * the read cursor, and the client `Thread` takes over from there with
 * Realtime for incoming messages.
 */
export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!uuidPattern.test(id)) notFound();

  const viewer = await requireApprovedMember();
  const supabase = await createClient();
  // Parallel: membership+messages+peer, streak, and avatar all resolve
  // together instead of one-after-another (3 serial round trips -> 1 wave).
  // Mark-read is fire-and-forget after the render data is in flight.
  const [thread, streak] = await Promise.all([
    loadThread(supabase, id, viewer.id),
    getConversationStreak(supabase, id),
  ]);

  if (!thread.isMember) notFound();

  try {
    const p = markConversationReadAction(id);
    if (p && typeof (p as Promise<void>).catch === "function") (p as Promise<void>).catch(() => {});
  } catch { /* read cursor is best-effort */ }

  const avatarUrl = thread.peer
    ? await signedStorageUrl(supabase, thread.peer.avatarPath)
    : null;

  return (
    <Thread
      conversationId={id}
      meId={viewer.id}
      initialMessages={thread.messages}
      peerName={thread.peer?.fullName ?? ""}
      peerUsername={thread.peer?.username ?? ""}
      peerAvatarUrl={avatarUrl}
      streak={streak}
    />
  );
}
