"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import {
  consumeRateLimit,
  hashRateLimitKey,
  rateLimitRules,
} from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";
import type { ActionState } from "@/features/auth/action-state";
import { requireAdmin } from "@/features/auth/session";
import {
  formDataToObject,
  inviteCodeCreateSchema,
} from "@/features/auth/validation";

/**
 * Admin-only operations: approving the queue and handing out invite codes.
 *
 * Every function re-checks the admin role server-side (`requireAdmin`) and the
 * database re-checks it again in RLS — the UI hiding a button is never the
 * control.
 */

export async function approveMemberAction(
  targetId: string,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.approval,
    hashRateLimitKey(`user:${admin.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const { error } = await supabase
    .from("profiles")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: admin.id,
      rejection_reason: null,
    })
    .eq("id", targetId)
    // Only ever moves a waiting account forward: approving twice is a no-op.
    .eq("status", "pending");

  if (error) return { status: "error", code: "approval_failed" };

  const locale = await getLocale();
  revalidatePath(`/${locale}/admin`);

  return { status: "success", code: "member_approved" };
}

export async function rejectMemberAction(
  targetId: string,
  reason: string,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({
      status: "rejected",
      rejection_reason: reason.trim().slice(0, 280) || null,
      approved_at: null,
      approved_by: admin.id,
    })
    .eq("id", targetId)
    .in("status", ["pending", "approved"]);

  if (error) return { status: "error", code: "approval_failed" };

  const locale = await getLocale();
  revalidatePath(`/${locale}/admin`);

  return { status: "success", code: "member_rejected" };
}

export async function suspendMemberAction(
  targetId: string,
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("profiles")
    .update({ status: "suspended" })
    .eq("id", targetId)
    .eq("status", "approved");

  if (error) return { status: "error", code: "approval_failed" };

  const locale = await getLocale();
  revalidatePath(`/${locale}/admin`);

  return { status: "success", code: "member_suspended" };
}

export async function createInviteCodeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const admin = await requireAdmin();
  const parsed = inviteCodeCreateSchema.safeParse(formDataToObject(formData));

  if (!parsed.success) {
    return {
      status: "error",
      code: "invalid_input",
      fields: parsed.error.issues.map((issue) => String(issue.path[0] ?? "")),
    };
  }

  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.inviteCreate,
    hashRateLimitKey(`user:${admin.id}`),
  );

  if (!withinLimit) return { status: "error", code: "too_many_attempts" };

  const { error } = await supabase.from("invite_codes").insert({
    code: parsed.data.code,
    label: parsed.data.label ?? null,
    max_uses: parsed.data.max_uses,
    created_by: admin.id,
  });

  if (error) {
    // 23505 = unique_violation: that code already exists.
    return {
      status: "error",
      code:
        error.code === "23505"
          ? "invite_code_duplicate"
          : "invite_create_failed",
    };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/admin`);

  return { status: "success", code: "invite_created" };
}

export async function setInviteCodeActiveAction(
  id: string,
  isActive: boolean,
): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createClient();

  const { error } = await supabase
    .from("invite_codes")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) return { status: "error", code: "invite_create_failed" };

  const locale = await getLocale();
  revalidatePath(`/${locale}/admin`);

  return { status: "success", code: "invite_created" };
}
