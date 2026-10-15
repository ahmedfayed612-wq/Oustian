"use client";
import { useFormatter, useTranslations } from "next-intl";
export function MessageInfo({ open, onClose, body, sentAt, deliveredAt, seenAt }: { open: boolean; onClose: () => void; body: string; sentAt: string; deliveredAt?: string | null; seenAt?: string | null }) {
  const t = useTranslations("Chat"); const format = useFormatter();
  if (!open) return null;
  const f = (v?: string | null) => (v ? format.dateTime(new Date(v), { hour: "numeric", minute: "2-digit" }) : "\u2014");
  return (
    <div role="dialog" aria-modal="true" aria-label={t("messageInfo")} className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-sm rounded-card bg-surface p-4 shadow-lift" onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold">{t("messageInfo")}</p>
        <p className="mt-2 truncate rounded-control bg-surface-2 px-3 py-2 text-sm" dir="auto">{body}</p>
        <dl className="mt-3 space-y-2 text-sm">
          <div className="flex justify-between"><dt className="text-muted">{t("sent")}</dt><dd>{f(sentAt)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{t("delivered")}</dt><dd>{f(deliveredAt)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted">{t("seen")}</dt><dd>{f(seenAt)}</dd></div>
        </dl>
        <button type="button" onClick={onClose} className="mt-4 w-full rounded-control bg-surface-2 py-2 text-sm font-semibold">{t("cancel")}</button>
      </div>
    </div>
  );
}
