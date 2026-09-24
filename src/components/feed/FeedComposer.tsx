import { BarChart3, CalendarPlus, Image as ImageIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { Link } from "@/i18n/navigation";

/**
 * The "what's on your mind?" bar that opens every social feed. Posting itself
 * arrives with the feed milestone, so all three actions take the member to the
 * create screen (which explains the roadmap) instead of doing nothing.
 */
export async function FeedComposer() {
  const t = await getTranslations("Composer");

  return (
    <Card className="p-3">
      <div className="flex items-center gap-2.5">
        <Avatar size="md" />
        <Link
          href="/create"
          className="flex min-h-11 flex-1 items-center rounded-pill bg-surface-2 px-4 text-sm text-muted transition-colors duration-200 ease-out-soft hover:bg-surface-2/70"
        >
          {t("placeholder")}
        </Link>
      </div>

      <div className="mt-2 flex items-center justify-between gap-1 border-t border-border pt-2">
        <ComposerAction
          href="/create"
          Icon={ImageIcon}
          label={t("photo")}
          tone="text-emerald-600 dark:text-emerald-400"
        />
        <ComposerAction
          href="/create"
          Icon={CalendarPlus}
          label={t("event")}
          tone="text-rose-500 dark:text-rose-400"
        />
        <ComposerAction
          href="/create"
          Icon={BarChart3}
          label={t("poll")}
          tone="text-amber-600 dark:text-amber-400"
        />
      </div>
    </Card>
  );
}

function ComposerAction({
  href,
  Icon,
  label,
  tone,
}: {
  href: string;
  Icon: typeof ImageIcon;
  label: string;
  tone: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-10 flex-1 items-center justify-center gap-2 rounded-control text-sm font-semibold text-muted transition-colors duration-200 ease-out-soft hover:bg-surface-2 hover:text-text"
    >
      <Icon className={`size-5 ${tone}`} aria-hidden="true" />
      <span>{label}</span>
    </Link>
  );
}
