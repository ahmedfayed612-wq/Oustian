import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { requireApprovedMember } from "@/features/auth/session";
import { EventForm } from "./event-form";

export async function generateMetadata() {
  const t = await getTranslations("Events");

  return { title: t("formTitle") };
}

/** Create an event — any approved member may publish one. */
export default async function EventCreatePage() {
  await requireApprovedMember();
  const t = await getTranslations("Events");

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("formTitle")} description={t("formHint")} />
      <EventForm />
    </div>
  );
}
