"use client";

export default function Toast({
  message,
  tone = "error",
  onDismiss,
}: {
  message: string;
  tone?: "error" | "success";
  onDismiss: () => void;
}) {
  if (!message) return null;

  const styles =
    tone === "success"
      ? "border-emerald-800 bg-emerald-950 text-emerald-100"
      : "border-red-900 bg-zinc-900 text-red-100";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed bottom-4 left-1/2 z-[70] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border px-4 py-3 text-sm shadow-xl ${styles}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span>{message}</span>
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="px-1 text-lg leading-none text-zinc-400 hover:text-white"
        >
          ×
        </button>
      </div>
    </div>
  );
}
