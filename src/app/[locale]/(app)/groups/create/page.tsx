import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireApprovedMember } from "@/features/auth/session";
import { listConnectedMembers } from "@/features/connections/queries";
import { listActiveSubjects } from "@/features/groups/queries";
import { createClient } from "@/lib/supabase/server";
import { GroupForm } from "../group-form";

export async function generateMetadata() {
  const t = await getTranslations("Groups");

  return { title: t("createTitle") };
}

/**
 * Creates a presentation group: subject picker + optional group name and
 * connection invitees. The actual write is the `create_presentation_group`
 * RPC (atomic group + owner row + invitations).
 */
export default async function CreateGroupPage() {
  const viewer = await requireApprovedMember();
  const t = await getTranslations("Groups");

  const supabase = await createClient();
  const [subjects, connections] = await Promise.all([
    listActiveSubjects(supabase),
    listConnectedMembers(supabase, viewer.id, 50),
  ]);

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("createTitle")} description={t("createHint")} />
      <GroupForm subjects={subjects} connections={connections} />
    </div>
  );
}
