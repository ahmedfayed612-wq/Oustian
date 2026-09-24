import { Sparkles } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Skeleton } from "@/components/ui/Skeleton";

/**
 * The feed layout before posts exist: a notice card plus two skeleton posts, so
 * the spacing, avatar sizes and action row are already correct when the real
 * feed (M3) drops in. No fake content — nothing here pretends to be a post.
 */
export async function FeedPlaceholder() {
  const t = await getTranslations("Feed");

  return (
    <div className="flex flex-col gap-3">
      <Card className="flex flex-col items-start gap-2 p-4">
        <Chip tone="accent">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {t("badge")}
        </Chip>
        <h2 className="text-[0.9375rem] font-semibold text-text">
          {t("placeholderTitle")}
        </h2>
        <p className="text-sm text-muted">{t("placeholderBody")}</p>
      </Card>

      {[0, 1].map((index) => (
        <PostSkeleton key={index} actionLabel={t("actionsLabel")} />
      ))}
    </div>
  );
}

function PostSkeleton({ actionLabel }: { actionLabel: string }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2.5 p-3">
        <Skeleton className="size-10 rounded-pill" />
        <span className="flex flex-1 flex-col gap-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </span>
      </div>

      <div className="flex flex-col gap-2 px-3 pb-3">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-4/5" />
      </div>

      <Skeleton className="aspect-4/3 w-full rounded-none" />

      <div className="flex items-center justify-around gap-1 border-t border-border p-1.5">
        {[0, 1, 2].map((slot) => (
          <Skeleton key={slot} className="h-8 flex-1 rounded-control" />
        ))}
      </div>
      <span className="sr-only">{actionLabel}</span>
    </Card>
  );
}
