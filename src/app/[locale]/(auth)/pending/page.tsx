import { Ban, CircleSlash, Hourglass } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { signOutAction } from "@/features/auth/actions";
import { requireSession } from "@/features/auth/session";
import { PendingRefresher } from "./pending-refresher";

export async function generateMetadata() {
  const t = await getTranslations("Auth.pending");

  return { title: t("metaTitle") };
}

/**
 * Where every account waits. Nothing in here needs an approved profile — it is
 * the one screen a pending member can reach.
 */
export default async function PendingPage() {
  const state = await requireSession();
  const t = await getTranslations("Auth.pending");

  const status = state.status === "approved" ? "pending" : state.status;
  const Icon =
    status === "rejected"
      ? CircleSlash
      : status === "suspended"
        ? Ban
        : Hourglass;

  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center">
      <span className="flex size-14 items-center justify-center rounded-pill bg-brand-soft text-brand">
        <Icon className="size-7" aria-hidden="true" />
      </span>

      <div>
        <h1 className="text-xl font-bold text-text">{t(`${status}.title`)}</h1>
        <p className="mt-2 text-sm text-muted">
          {t(`${status}.body`, {
            name:
              state.status === "approved" ? "" : state.profile.full_name || "",
          })}
        </p>
      </div>

      {state.status === "rejected" && state.profile.rejection_reason ? (
        <p className="w-full rounded-control border border-border bg-surface-2 px-3 py-2 text-sm text-text">
          {state.profile.rejection_reason}
        </p>
      ) : null}

      {status === "pending" ? <PendingRefresher /> : null}

      <form action={signOutAction} className="w-full">
        <Button type="submit" variant="ghost" className="w-full">
          {t("signOut")}
        </Button>
      </form>
    </Card>
  );
}
