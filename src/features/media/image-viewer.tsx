"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export type ImageViewerProps = {
  src: string;
  alt?: string | null;
  isOpen: boolean;
  onClose: () => void;
};

/**
 * Accessible full-screen photo lightbox.
 * - Closes on Escape key press or backdrop click.
 * - Disables background page scroll while active.
 * - Restores focus to the trigger button on unmount / close.
 * - Traps Tab navigation within the viewer.
 */
export function ImageViewer({
  src,
  alt,
  isOpen,
  onClose,
}: ImageViewerProps) {
  const t = useTranslations("Post");
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const triggerRef = useRef<Element | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    // Remember element that opened the viewer so we can return focus
    triggerRef.current = document.activeElement;

    // Focus close button initially
    closeButtonRef.current?.focus();

    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      } else if (event.key === "Tab") {
        // Only one interactive element in the viewer (close button), keep focus locked to it
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = originalOverflow;
      if (triggerRef.current instanceof HTMLElement) {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={alt || t("viewPhoto")}
        onClick={(event) => event.stopPropagation()}
        className="relative flex max-h-[92dvh] max-w-5xl flex-col items-center justify-center"
      >
        <button
          ref={closeButtonRef}
          type="button"
          onClick={onClose}
          aria-label={t("closePhoto")}
          className="absolute -top-12 right-0 flex size-10 items-center justify-center rounded-full bg-surface/80 text-text backdrop-blur transition hover:bg-surface focus-visible:outline-2 focus-visible:outline-brand sm:top-2 sm:right-2"
        >
          <X className="size-5" aria-hidden="true" />
        </button>

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt || ""}
          className="max-h-[85dvh] max-w-full rounded-md object-contain shadow-2xl select-none"
        />

        {alt ? (
          <p className="mt-3 max-w-xl text-center text-xs text-white/80 line-clamp-2">
            {alt}
          </p>
        ) : null}
      </div>
    </div>
  );
}
