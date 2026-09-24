import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signedStorageUrl } from "@/lib/supabase/storage";
import { markConversationReadAction } from "@/features/chat/actions";
import { loadThread, uuidPattern } from "@/features/chat/queries";
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
  const thread = await loadThread(supabase, id, viewer.id);

  if (!thread.isMember) notFound();

  await markConversationReadAction(id);

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
    />
  );
}
