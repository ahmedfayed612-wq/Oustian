"use client";

import { useTranslations } from "next-intl";
import { Clock3, RefreshCw } from "lucide-react";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";

/**
 * Keeps the holding screen honest: approval happens in an admin's session, so
 * this quietly re-fetches the page every 30 seconds and offers a manual retry.
 */
export function PendingRefresher() {
  const t = useTranslations("Auth.pending");
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => router.refresh(), 30_000);

    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="flex flex-col items-center gap-2">
      <Button
        variant="secondary"
        onClick={() => router.refresh()}
        className="w-full sm:w-auto"
      >
        <RefreshCw className="size-4" aria-hidden="true" />
        {t("refresh")}
      </Button>
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Clock3 className="size-3.5" aria-hidden="true" />
        {t("autoRefresh")}
      </p>
    </div>
  );
}
