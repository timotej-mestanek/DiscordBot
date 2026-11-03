"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import type { PointCurrency, UserIdentity } from "@/app/dashboard/users-types";

export default function UserPointsEditor({
  userName,
  currency,
  identity,
  busy,
  error,
  onClose,
  onSave,
}: {
  userName: string;
  currency: PointCurrency;
  identity: UserIdentity;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (delta: number, reason: string) => void;
}) {
  const [delta, setDelta] = useState("1");
  const [reason, setReason] = useState("Admin adjustment");
  const [validationError, setValidationError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(delta);
    if (!Number.isSafeInteger(amount) || amount === 0 || !reason.trim()) {
      setValidationError("Enter a non-zero whole number and a reason.");
      return;
    }
    setValidationError("");
    onSave(amount, reason.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-points-title"
        className="app-fixed-dialog"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
              Edit points
            </p>
            <h2 id="edit-points-title" className="mt-1 text-xl font-bold">
              {userName}
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Close
          </button>
        </div>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <p className="text-sm text-zinc-300">
            {currency === "discord" ? "Discord" : "Twitch"} balance:{" "}
            {identity.points.toLocaleString()}
          </p>
          <label className="block text-xs text-zinc-400">
            Change
            <input
              type="number"
              step="1"
              required
              value={delta}
              onChange={(event) => {
                setDelta(event.target.value);
                setValidationError("");
              }}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="block text-xs text-zinc-400">
            Reason
            <input
              type="text"
              maxLength={500}
              required
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setValidationError("");
              }}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white"
            />
          </label>
          {(validationError || error) && (
            <p role="alert" className="text-sm text-red-300">{validationError || error}</p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="app-fixed-button bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-50"
          >
            {busy ? "Saving…" : "Update points"}
          </button>
        </form>
      </section>
    </div>
  );
}
