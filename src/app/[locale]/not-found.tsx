import { Compass } from "lucide-react";
import { useTranslations } from "next-intl";
import { buttonClasses } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/i18n/navigation";

export default function NotFoundPage() {
  const t = useTranslations("NotFound");

  return (
    <div className="flex min-h-[55dvh] items-center">
      <EmptyState
        className="w-full"
        icon={<Compass className="size-6" aria-hidden="true" />}
        title={t("title")}
        description={t("description")}
        action={
          <Link href="/" className={buttonClasses()}>
            {t("cta")}
          </Link>
        }
      />
    </div>
  );
}
