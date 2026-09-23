import { useTranslations } from "next-intl";
import { Chip } from "./Chip";
import { EmptyState } from "./EmptyState";
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
    <EmptyState
      className={className}
      icon={<Icon className="size-6" />}
      title={t("title")}
      description={t("description")}
      action={
        <Chip tone="accent">
          <HighlightIcon className="size-3.5" />
          {tCommon("comingSoon")}
        </Chip>
      }
    />
  );
}
