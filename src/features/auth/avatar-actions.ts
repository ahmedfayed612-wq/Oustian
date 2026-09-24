"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  AVATAR_BUCKET,
  avatarObjectPath,
  isAvatarExtension,
} from "@/lib/supabase/storage";
import type { ActionState } from "@/features/auth/action-state";
import { getSessionState } from "@/features/auth/session";

/**
 * Avatar writes.
 *
 * The file itself never passes through a server action: Vercel caps request
 * bodies at ~4.5 MB, so the flow is
 *
 *   1. `createAvatarUploadTicketAction()` — permission check, then a signed
 *      upload URL for the caller's own folder,
 *   2. the browser PUTs the bytes straight to Supabase Storage,
 *   3. `setAvatarPathAction()` — records the path on the profile.
 */
export type AvatarUploadTicket =
  | { ok: true; path: string; token: string; bucket: string }
  | { ok: false; code: string };

export async function createAvatarUploadTicketAction(
  extension: string,
): Promise<AvatarUploadTicket> {
  const state = await getSessionState();

  if (state.status !== "approved") {
    return { ok: false, code: "not_authorised" };
  }

  if (!isAvatarExtension(extension)) {
    return { ok: false, code: "avatar_upload_failed" };
  }

  const supabase = await createClient();
  const path = avatarObjectPath(state.profile.id, extension);

  const { data, error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[avatar] could not create upload url", error?.message);
    return { ok: false, code: "avatar_upload_failed" };
  }

  return { ok: true, path, token: data.token, bucket: AVATAR_BUCKET };
}

export async function setAvatarPathAction(path: string): Promise<ActionState> {
  const state = await getSessionState();

  if (state.status !== "approved") {
    return { status: "error", code: "not_authorised" };
  }

  // A member can only ever point their profile at their own folder — the
  // storage policy enforces this too, but the action must not rely on the
  // database alone.
  if (!path.startsWith(`${state.profile.id}/`)) {
    return { status: "error", code: "avatar_upload_failed" };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("id", state.profile.id);

  if (error) {
    return { status: "error", code: "avatar_upload_failed" };
  }

  const locale = await getLocale();

  revalidatePath(`/${locale}/profile`);
  revalidatePath(`/${locale}/profile/edit`);

  return { status: "success", code: "profile_saved" };
}

export async function removeAvatarAction(): Promise<ActionState> {
  const state = await getSessionState();

  if (state.status !== "approved") {
    return { status: "error", code: "not_authorised" };
  }

  const previousPath = state.profile.avatar_path;
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("id", state.profile.id);

  if (error) {
    return { status: "error", code: "avatar_upload_failed" };
  }

  if (previousPath) {
    // Best effort: an orphaned object is harmless, a failed profile update is not.
    await supabase.storage.from(AVATAR_BUCKET).remove([previousPath]);
  }

  const locale = await getLocale();

  revalidatePath(`/${locale}/profile`);
  revalidatePath(`/${locale}/profile/edit`);

  return { status: "success", code: "profile_saved" };
}
