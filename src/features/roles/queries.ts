import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

export type UniversityRoleRow = Tables<"university_roles">;

export type UserVerifiedRole = {
  id: string;
  roleId: string;
  nameEn: string;
  nameAr: string;
  category: "teaching" | "administrative" | "leadership" | "support" | "other";
  displayPriority: number;
  verificationStatus: "pending" | "verified" | "rejected" | "revoked" | "expired";
  verifiedAt: string | null;
  expiresAt: string | null;
};

export type AdminRoleAssignmentRow = Tables<"user_university_roles"> & {
  user: Pick<Tables<"profiles">, "id" | "username" | "full_name" | "avatar_path"> | null;
  role: Tables<"university_roles"> | null;
  verifier: Pick<Tables<"profiles">, "id" | "username" | "full_name"> | null;
};

/**
 * Batch loads verified active roles for multiple user IDs.
 * Used across feed posts, comments, profile, and search to eliminate N+1 queries.
 */
export async function batchGetUserVerifiedRoles(
  supabase: SupabaseClient<Database>,
  userIds: string[],
): Promise<Map<string, UserVerifiedRole[]>> {
  const result = new Map<string, UserVerifiedRole[]>();
  if (userIds.length === 0) return result;

  const uniqueIds = Array.from(new Set(userIds));

  const { data, error } = await supabase
    .from("user_university_roles")
    .select(`
      id,
      user_id,
      university_role_id,
      verification_status,
      verified_at,
      expires_at,
      role:university_roles(
        name_en,
        name_ar,
        category,
        display_priority,
        is_active
      )
    `)
    .in("user_id", uniqueIds)
    .eq("verification_status", "verified")
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

  if (error) {
    console.error("[roles] batchGetUserVerifiedRoles error", error.message);
    return result;
  }

  return buildVerifiedRoleMap(data ?? []);
}

/** One raw join row as PostgREST returns it. */
export type VerifiedRoleRow = {
  id: string;
  user_id: string;
  university_role_id: string;
  verification_status: UserVerifiedRole["verificationStatus"];
  verified_at: string | null;
  expires_at: string | null;
  role: {
    name_en: string;
    name_ar: string;
    category: UserVerifiedRole["category"];
    display_priority: number;
    is_active: boolean;
  } | null;
};

/**
 * Pure transform: groups raw join rows per user, drops inactive role
 * definitions, and sorts each user's badges by display priority (desc).
 * Split out of the fetch so the mapping rules are unit-testable without a
 * database.
 */
export function buildVerifiedRoleMap(
  rows: VerifiedRoleRow[],
): Map<string, UserVerifiedRole[]> {
  const result = new Map<string, UserVerifiedRole[]>();

  rows.forEach((row) => {
    if (!row.role || !row.role.is_active) return;

    const list = result.get(row.user_id) ?? [];
    list.push({
      id: row.id,
      roleId: row.university_role_id,
      nameEn: row.role.name_en,
      nameAr: row.role.name_ar,
      category: row.role.category,
      displayPriority: row.role.display_priority,
      verificationStatus: row.verification_status,
      verifiedAt: row.verified_at,
      expiresAt: row.expires_at,
    });
    result.set(row.user_id, list);
  });

  // Sort each user's roles by display priority descending
  result.forEach((roles) => {
    roles.sort((a, b) => b.displayPriority - a.displayPriority);
  });

  return result;
}

/**
 * List all available university role definitions.
 */
export async function listUniversityRoles(
  supabase: SupabaseClient<Database>,
  universitySlug = "oust",
): Promise<UniversityRoleRow[]> {
  const { data, error } = await supabase
    .from("university_roles")
    .select("*, universities!inner(slug)")
    .eq("is_active", true)
    .eq("universities.slug", universitySlug)
    .order("display_priority", { ascending: false });

  if (error) {
    console.error("[roles] listUniversityRoles error", error.message);
    return [];
  }

  return (data as unknown as UniversityRoleRow[]) ?? [];
}

/**
 * List all role assignments for admin verification management.
 */
export async function listAdminRoleAssignments(
  supabase: SupabaseClient<Database>,
): Promise<AdminRoleAssignmentRow[]> {
  const { data, error } = await supabase
    .from("user_university_roles")
    .select(`
      *,
      user:profiles!user_university_roles_user_id_fkey(id, username, full_name, avatar_path),
      role:university_roles(*),
      verifier:profiles!user_university_roles_verified_by_fkey(id, username, full_name)
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[roles] listAdminRoleAssignments error", error.message);
    return [];
  }

  return (data as unknown as AdminRoleAssignmentRow[]) ?? [];
}
