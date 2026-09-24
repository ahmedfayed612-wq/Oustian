import { useTranslations } from "next-intl";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils/cn";
import { Card } from "./Card";
import { Chip } from "./Chip";
import {
  placeholderHighlightIcon,
  placeholderIcons,
  type PlaceholderSection,
} from "./placeholder-icons";

/**
 * Shared "this section is on its way" panel.
 *
 * Every route in the navigation ships a real page from day one so links never
 * 404; each one is replaced by the real screen in its own milestone.
 */
export function ComingSoon({
  section,
  className,
}: {
  section: PlaceholderSection;
  className?: string;
}) {
  const t = useTranslations(`Placeholder.${section}`);
  const tCommon = useTranslations("Common");
  const Icon = placeholderIcons[section];
  const HighlightIcon = placeholderHighlightIcon;

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <PageHeader title={t("title")} description={t("description")} />

      <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
        <span className="flex size-14 items-center justify-center rounded-pill bg-brand-soft text-brand">
          <Icon className="size-7" aria-hidden="true" />
        </span>
        <Chip tone="accent">
          <HighlightIcon className="size-3.5" aria-hidden="true" />
          {tCommon("comingSoon")}
        </Chip>
        <p className="max-w-sm text-sm text-muted">{tCommon("inProgress")}</p>
      </Card>
    </div>
  );
}
