import type { Tables } from "@/lib/supabase/database.types";
export type ChatMessageRow = Tables<"messages"> & { reply_to_message_id?: string | null; is_edited?: boolean | null; edited_at?: string | null; deleted_for_all?: boolean | null; deleted_for?: string[] | null; };
export type Receipt = { message_id: string; user_id: string; delivered_at: string | null; seen_at: string | null };
export type Reaction = { message_id: string; user_id: string; emoji: string };
export const REACTION_SET = ["\u2764\uFE0F","\uD83D\uDC4D","\uD83D\uDE02","\uD83D\uDE2E","\uD83D\uDE22","\uD83D\uDE4F"] as const;
export type ReceiptMap = Record<string, Receipt[]>;
export type ReactionMap = Record<string, Reaction[]>;
