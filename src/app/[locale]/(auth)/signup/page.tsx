import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { facultyOptions, graduationYearOptions } from "@/lib/profile-options";
import { SignUpForm } from "./signup-form";

export async function generateMetadata() {
  const t = await getTranslations("Auth");

  return { title: t("signup.title") };
}

export default async function SignUpPage() {
  const t = await getTranslations("Auth");
  const locale = await getLocale();

  // Pickers are built on the server so their labels follow the active language
  // without shipping both lists to the browser.
  const faculties = facultyOptions.map((option) => ({
    value: option.value,
    label: locale === "ar" ? option.nameAr : option.nameEn,
  }));

  const years = graduationYearOptions();

  return (
    <div className="flex flex-col gap-3">
      <SignUpForm faculties={faculties} years={years} />

      <p className="text-center text-sm text-muted">
        {t("signup.haveAccount")}{" "}
        <Link
          href="/login"
          className="font-semibold text-brand hover:underline"
        >
          {t("login.submit")}
        </Link>
      </p>
    </div>
  );
}
