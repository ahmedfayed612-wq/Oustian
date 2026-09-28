import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/lib/supabase/database.types";

export type PresentationGroupRow = Tables<"presentation_groups"> & {
  subject?: Tables<"university_subjects"> | null;
  members?: (Tables<"presentation_group_members"> & {
    profile?: Pick<Tables<"profiles">, "id" | "username" | "full_name" | "avatar_path"> | null;
  })[];
  memberCount?: number;
};

export type PresentationGroupInvitationRow = Tables<"presentation_group_invitations"> & {
  group?: Tables<"presentation_groups"> & {
    subject?: Tables<"university_subjects"> | null;
  };
  inviter?: Pick<Tables<"profiles">, "id" | "username" | "full_name" | "avatar_path"> | null;
};

export type SubjectOption = Tables<"university_subjects">;

/**
 * Fetch active subjects grouped by faculty or flat list.
 */
export async function listActiveSubjects(
  supabase: SupabaseClient<Database>,
  universitySlug = "oust",
): Promise<SubjectOption[]> {
  const { data, error } = await supabase
    .from("university_subjects")
    .select("*, universities!inner(slug)")
    .eq("is_active", true)
    .eq("universities.slug", universitySlug)
    .order("faculty", { ascending: true })
    .order("code", { ascending: true });

  if (error) {
    console.error("[groups] listActiveSubjects error", error.message);
    return [];
  }

  return (data as unknown as SubjectOption[]) ?? [];
}

/**
 * List presentation groups the user belongs to.
 */
export async function listMyPresentationGroups(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PresentationGroupRow[]> {
  const { data: memberRows, error: memberErr } = await supabase
    .from("presentation_group_members")
    .select("group_id")
    .eq("user_id", userId);

  if (memberErr || !memberRows || memberRows.length === 0) {
    return [];
  }

  const groupIds = memberRows.map((m) => m.group_id);

  const { data: groups, error: groupErr } = await supabase
    .from("presentation_groups")
    .select(`
      *,
      subject:university_subjects(*)
    `)
    .in("id", groupIds)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (groupErr || !groups) {
    console.error("[groups] listMyPresentationGroups error", groupErr?.message);
    return [];
  }

  // Count members for each
  const { data: allMembers } = await supabase
    .from("presentation_group_members")
    .select("group_id")
    .in("group_id", groupIds);

  const countMap = new Map<string, number>();
  (allMembers ?? []).forEach((m) => {
    countMap.set(m.group_id, (countMap.get(m.group_id) ?? 0) + 1);
  });

  return groups.map((g) => ({
    ...g,
    subject: g.subject ?? null,
    memberCount: countMap.get(g.id) ?? 1,
  }));
}

/**
 * Get single presentation group with full member profiles.
 */
export async function getPresentationGroupDetail(
  supabase: SupabaseClient<Database>,
  groupId: string,
): Promise<PresentationGroupRow | null> {
  const { data: group, error: groupErr } = await supabase
    .from("presentation_groups")
    .select(`
      *,
      subject:university_subjects(*)
    `)
    .eq("id", groupId)
    .maybeSingle();

  if (groupErr || !group) {
    return null;
  }

  const { data: members, error: memErr } = await supabase
    .from("presentation_group_members")
    .select(`
      *,
      profile:profiles(id, username, full_name, avatar_path)
    `)
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });

  if (memErr) {
    console.error("[groups] getPresentationGroupDetail members error", memErr.message);
  }

  return {
    ...group,
    subject: group.subject ?? null,
    members: (members as unknown as PresentationGroupRow["members"]) ?? [],
    memberCount: members?.length ?? 0,
  };
}

/**
 * List incoming pending presentation group invitations for a user.
 */
export async function listPendingGroupInvitations(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<PresentationGroupInvitationRow[]> {
  const { data, error } = await supabase
    .from("presentation_group_invitations")
    .select(`
      *,
      group:presentation_groups(
        *,
        subject:university_subjects(*)
      ),
      inviter:profiles!presentation_group_invitations_inviter_id_fkey(
        id, username, full_name, avatar_path
      )
    `)
    .eq("invitee_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("[groups] listPendingGroupInvitations error", error.message);
    return [];
  }

  return (data as unknown as PresentationGroupInvitationRow[]) ?? [];
}
