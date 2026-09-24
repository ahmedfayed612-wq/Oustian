import { Search } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { EmptyState } from "@/components/ui/EmptyState";

export async function generateMetadata() {
  const t = await getTranslations("Search");

  return { title: t("label") };
}

export default async function SearchPage() {
  const t = await getTranslations("Search");

  return (
    <div className="flex flex-col gap-3">
      <PageHeader title={t("label")} description={t("description")} />

      <Card className="p-4">
        <label htmlFor="oustians-search" className="sr-only">
          {t("label")}
        </label>
        <div className="flex items-center gap-2 rounded-pill bg-surface-2 px-4">
          <Search className="size-4 text-muted" aria-hidden="true" />
          <input
            id="oustians-search"
            type="search"
            disabled
            placeholder={t("placeholder")}
            className="min-h-11 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted disabled:cursor-not-allowed"
          />
          <Chip tone="accent">{t("soon")}</Chip>
        </div>
      </Card>

      <EmptyState
        icon={<Search className="size-6" aria-hidden="true" />}
        title={t("emptyTitle")}
        description={t("emptyBody")}
      />
    </div>
  );
}
