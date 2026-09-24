"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { useRouter } from "@/i18n/navigation";
import { startConversationAction } from "./actions";

/**
 * "Message" on a profile: asks Postgres for the 1:1 thread (idempotent — a
 * second tap opens the same conversation) and navigates into it.
 */
export function MessageButton({
  otherId,
  className,
}: {
  otherId: string;
  className?: string;
}) {
  const t = useTranslations("Chat");
  const tAuth = useTranslations("Auth.errors");
  const router = useRouter();

  const [pending, setPending] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  async function handleClick() {
    setPending(true);
    setErrorKey(null);

    try {
      const result = await startConversationAction(otherId);

      if (result.status === "success" && result.conversationId) {
        router.push(`/chat/${result.conversationId}`);
        return;
      }

      setErrorKey(result.code ?? "start_failed");
    } catch {
      setErrorKey("start_failed");
    } finally {
      setPending(false);
    }
  }

  function errorText(key: string): string {
    switch (key) {
      case "too_many_attempts":
        return tAuth("too_many_attempts");
      case "not_authorised":
        return tAuth("not_authorised");
      case "invalid_conversation":
        return t("errors.invalid_conversation");
      default:
        return t("errors.start_failed");
    }
  }

  return (
    <span className="inline-flex flex-col gap-1.5">
      <Button
        variant="primary"
        size="md"
        onClick={handleClick}
        isLoading={pending}
        loadingLabel={t("opening")}
        className={className}
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {t("messageButton")}
      </Button>

      {errorKey ? (
        <span role="alert" className="text-sm text-danger">
          {errorText(errorKey)}
        </span>
      ) : null}
    </span>
  );
}
