"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { requireAdmin } from "@/features/auth/session";
import { consumeRateLimit, hashRateLimitKey, rateLimitRules } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type RoleActionResult = {
  status: "success" | "error";
  error?: string;
};

/**
 * Admin assigns a role to a user.
 */
export async function assignUserRoleAction(
  userId: string,
  universityRoleId: string,
  autoVerify = true,
  reason?: string,
): Promise<RoleActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.roleAdmin,
    hashRateLimitKey(`admin:${admin.id}`),
  );
  if (!withinLimit) {
    return { status: "error", error: "Too many attempts. Please wait a moment." };
  }

  // Insert role assignment
  const { data: newRow, error } = await supabase
    .from("user_university_roles")
    .insert({
      user_id: userId,
      university_role_id: universityRoleId,
      verification_status: autoVerify ? "verified" : "pending",
      verified_by: autoVerify ? admin.id : null,
      verified_at: autoVerify ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("[roles] assignUserRoleAction error", error);
    return { status: "error", error: error.message || "Failed to assign role." };
  }

  // Record audit log
  await supabase.from("user_role_audit_logs").insert({
    user_role_id: newRow.id,
    user_id: userId,
    actor_id: admin.id,
    previous_status: null,
    new_status: autoVerify ? "verified" : "pending",
    reason: reason ?? (autoVerify ? "Admin assigned and verified" : "Admin requested assignment"),
  });

  const locale = await getLocale();
  revalidatePath(`/${locale}/admin`);
  return { status: "success" };
}

/**
 * Admin updates verification status (verify, reject, revoke) with audit trail.
 */
export async function setRoleVerificationAction(
  userRoleId: string,
  newStatus: "verified" | "rejected" | "revoked" | "expired",
  reason?: string,
  expiresAt?: string,
): Promise<RoleActionResult> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const withinLimit = await consumeRateLimit(
    supabase,
    rateLimitRules.roleAdmin,
    hashRateLimitKey(`admin:${admin.id}`),
  );
  if (!withinLimit) {
    return { status: "error", error: "Too many attempts. Please wait a moment." };
  }

  const { error } = await supabase.rpc("set_user_role_verification", {
    p_user_role_id: userRoleId,
    p_new_status: newStatus,
    p_reason: reason,
    p_expires_at: expiresAt,
  });

  if (error) {
    console.error("[roles] setRoleVerificationAction error", error);
    return { status: "error", error: error.message || "Failed to update role verification." };
  }

  const locale = await getLocale();
  revalidatePath(`/${locale}/admin`);
  return { status: "success" };
}
