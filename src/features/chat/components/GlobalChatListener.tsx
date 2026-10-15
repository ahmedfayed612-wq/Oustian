"use client";
import { ChatNotification } from "./ChatNotification";
export function GlobalChatListener({ meId, activeConversationId }: { meId: string; activeConversationId?: string | null }) {
  return <ChatNotification meId={meId} activeConversationId={activeConversationId} />;
}
