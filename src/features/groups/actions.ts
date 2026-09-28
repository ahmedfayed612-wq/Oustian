"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireApprovedMember } from "@/features/auth/session";
import { consumeRateLimit, hashRateLimitKey, rateLimitRules } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type GroupActionResult = {
  status: "success" | "error";
  groupId?: string;
  error?: string;
};

/**
 * Creates a presentation group atomically with optional initial connection invitees.
 */
export async function createPresentationGroupAction(
  prevState: unknown,
  formData: FormData,
): Promise<GroupActionResult> {
  const member = await requireApprovedMember();
  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.groupCreate,
    hashRateLimitKey(`user:${member.id}`),
  );
  if (!withinLimit) {
    return { status: "error", error: "Too many attempts. Please wait a moment." };
  }

  const subjectId = formData.get("subject_id")?.toString().trim();
  const name = formData.get("name")?.toString().trim() || undefined;
  const description = formData.get("description")?.toString().trim() || undefined;
  // Dedupe: the same connection ticked twice would otherwise insert two
  // notification rows for one pending invitation.
  const rawInvitees = [
    ...new Set(
      formData
        .getAll("invitees")
        .map((v) => v.toString().trim())
        .filter(Boolean),
    ),
  ];

  if (!subjectId) {
    return { status: "error", error: "Subject is required." };
  }

  if (rawInvitees.length > 9) {
    return { status: "error", error: "A presentation group can have at most 10 members (including you)." };
  }

  const { data, error } = await supabase.rpc("create_presentation_group", {
    p_subject_id: subjectId,
    p_name: name,
    p_description: description,
    p_initial_invitees: rawInvitees,
  });

  if (error) {
    console.error("[groups] create_presentation_group error", error);
    if (error.message.includes("group_limit_exceeded")) {
      return { status: "error", error: "Cannot invite more than 9 initial members." };
    }
    return { status: "error", error: error.message || "Failed to create presentation group." };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/groups`);

  return { status: "success", groupId: data };
}

/**
 * Owner invites a connected peer to their presentation group.
 */
export async function inviteGroupMemberAction(
  groupId: string,
  inviteeId: string,
): Promise<GroupActionResult> {
  const member = await requireApprovedMember();
  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.groupInvite,
    hashRateLimitKey(`user:${member.id}`),
  );
  if (!withinLimit) {
    return { status: "error", error: "Too many attempts. Please wait a moment." };
  }

  const { error } = await supabase.rpc("invite_to_presentation_group", {
    p_group_id: groupId,
    p_invitee_id: inviteeId,
  });

  if (error) {
    console.error("[groups] invite_to_presentation_group error", error);
    if (error.message.includes("group_limit_reached")) {
      return { status: "error", error: "This group already has the maximum of 10 members." };
    }
    if (error.message.includes("must_be_connected")) {
      return { status: "error", error: "You can only invite members you are connected with." };
    }
    if (error.message.includes("already_member")) {
      return { status: "error", error: "This member is already in the group." };
    }
    return { status: "error", error: error.message || "Failed to send invitation." };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/groups/${groupId}`);
  return { status: "success", groupId };
}

/**
 * Member responds (accept or decline) to a presentation group invitation.
 */
export async function respondGroupInvitationAction(
  invitationId: string,
  accept: boolean,
): Promise<GroupActionResult> {
  const member = await requireApprovedMember();
  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.groupAction,
    hashRateLimitKey(`user:${member.id}`),
  );
  if (!withinLimit) {
    return { status: "error", error: "Too many attempts. Please wait a moment." };
  }

  const { error } = await supabase.rpc("respond_presentation_group_invitation", {
    p_invitation_id: invitationId,
    p_accept: accept,
  });

  if (error) {
    console.error("[groups] respond_presentation_group_invitation error", error);
    if (error.message.includes("group_limit_reached")) {
      return { status: "error", error: "This group reached the maximum of 10 members." };
    }
    return { status: "error", error: error.message || "Failed to respond to invitation." };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/groups`);
  revalidatePath(`/${locale}/notifications`);
  return { status: "success" };
}

/**
 * Member leaves or owner removes another member from the presentation group.
 */
export async function leaveOrRemoveGroupMemberAction(
  groupId: string,
  targetUserId?: string,
): Promise<GroupActionResult> {
  const member = await requireApprovedMember();
  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.groupAction,
    hashRateLimitKey(`user:${member.id}`),
  );
  if (!withinLimit) {
    return { status: "error", error: "Too many attempts. Please wait a moment." };
  }

  const { error } = await supabase.rpc("leave_presentation_group", {
    p_group_id: groupId,
    p_target_user_id: targetUserId,
  });

  if (error) {
    console.error("[groups] leave_presentation_group error", error);
    return { status: "error", error: error.message || "Action failed." };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/groups`);
  revalidatePath(`/${locale}/groups/${groupId}`);
  return { status: "success", groupId };
}
