"use client";

export default function ChatThreadError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="text-[0.9375rem] font-semibold text-text">
        This conversation couldn&apos;t load.
      </p>
      <p className="max-w-sm text-sm text-muted">
        The chat ran into a problem. Try again — your messages are safe.
      </p>
      <div className="mt-1 flex gap-2">
        <button
          type="button"
          onClick={() => reset()}
          className="inline-flex min-h-11 items-center rounded-control bg-brand px-4 text-[0.9375rem] font-semibold text-on-brand"
        >
          Try again
        </button>
        <a
          href="../"
          className="inline-flex min-h-11 items-center rounded-control bg-surface-2 px-4 text-[0.9375rem] font-semibold"
        >
          Back to chats
        </a>
      </div>
    </div>
  );
}
