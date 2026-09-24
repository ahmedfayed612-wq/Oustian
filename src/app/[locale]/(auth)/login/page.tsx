import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LoginForm } from "./login-form";

export async function generateMetadata() {
  const t = await getTranslations("Auth");

  return { title: t("login.title") };
}

export default async function LoginPage() {
  const t = await getTranslations("Auth");

  return (
    <div className="flex flex-col gap-3">
      <LoginForm />

      <p className="text-center text-sm text-muted">
        {t("login.newHere")}{" "}
        <Link
          href="/signup"
          className="font-semibold text-brand hover:underline"
        >
          {t("signup.submit")}
        </Link>
      </p>
    </div>
  );
}
