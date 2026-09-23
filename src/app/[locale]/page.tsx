import { Languages, Lock, Sparkles } from "lucide-react";
import { useTranslations } from "next-intl";
import { BrandMark } from "@/components/brand/BrandMark";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";

/**
 * M0 placeholder for the home screen. The two-tab feed replaces this in M3.
 */
export default function HomePage() {
  const t = useTranslations("Home");
  const tCommon = useTranslations("Common");
  const tBrand = useTranslations("Brand");

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-5">
        <div className="flex items-center gap-3">
          <BrandMark variant="mark" size="lg" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-text">{t("heroTitle")}</h1>
            <p className="text-sm text-muted">{tBrand("tagline")}</p>
          </div>
        </div>
        <p className="mt-3 text-body text-muted">{t("heroBody")}</p>
        <Chip tone="accent" className="mt-4">
          <Sparkles className="size-3.5" aria-hidden="true" />
          {tCommon("comingSoon")}
        </Chip>
      </Card>

      <InfoCard
        icon={<Sparkles className="size-5" aria-hidden="true" />}
        title={t("statusTitle")}
        body={t("statusBody")}
      />
      <InfoCard
        icon={<Languages className="size-5" aria-hidden="true" />}
        title={t("languageTitle")}
        body={t("languageBody")}
      />
      <InfoCard
        icon={<Lock className="size-5" aria-hidden="true" />}
        title={t("privacyTitle")}
        body={t("privacyBody")}
      />
    </div>
  );
}

function InfoCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <Card className="flex items-start gap-3 p-4">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-brand-soft text-brand">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 className="text-[0.9375rem] font-semibold text-text">{title}</h2>
        <p className="mt-1 text-sm text-muted">{body}</p>
      </div>
    </Card>
  );
}
