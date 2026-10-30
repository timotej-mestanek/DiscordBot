"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addItemToCrate,
  removeItemFromCrate,
  updateCrateItemWeight,
} from "@/lib/black-market/admin-actions";

type CrateItem = { id: string; name: string; weight: number };
type AvailableItem = { id: string; name: string };

function errorText(code: string) {
  const messages: Record<string, string> = {
    FORBIDDEN: "You do not have permission to change crate contents.",
    VALIDATION_ERROR: "Weight must be a positive whole number up to 1,000,000.",
    NOT_FOUND: "The crate or item no longer exists. Refresh and try again.",
    CONFLICT: "That item is already in this crate.",
    INTERNAL_ERROR: "The crate contents could not be updated.",
  };
  return messages[code] ?? "The crate contents could not be updated.";
}

export default function CrateItemsManager({
  crateId,
  totalWeight,
  items,
  availableItems,
}: {
  crateId: string;
  totalWeight: number;
  items: CrateItem[];
  availableItems: AvailableItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  async function mutate(
    key: string,
    action: () => Promise<{ type: "success" } | { type: "error"; code: string }>,
  ) {
    setBusy(key);
    setError("");
    try {
      const result = await action();
      if (result.type === "error") {
        setError(errorText(result.code));
        return;
      }
      router.refresh();
    } catch (requestError) {
      console.error("Black Market crate item update failed:", requestError);
      setError("The crate contents could not be updated.");
    } finally {
      setBusy("");
    }
  }

  async function add(formData: FormData) {
    const itemId = String(formData.get("itemId") ?? "");
    const weight = Number(formData.get("weight"));
    if (!itemId) {
      setError("Select an item to add.");
      return;
    }
    await mutate(`add-${itemId}`, () => addItemToCrate(crateId, itemId, weight));
  }

  return (
    <div className="space-y-8">
      <section className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="border-b border-zinc-800 px-5 py-4">
          <h2 className="font-semibold">Items in this crate</h2>
          <p className="mt-1 text-sm text-zinc-400">Drop chance = item weight ÷ total weight.</p>
        </div>
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Weight</th>
              <th className="px-4 py-3">Drop chance</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {items.map((item) => {
              const percentage = totalWeight > 0 ? item.weight / totalWeight * 100 : 0;
              return (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-white">{item.name}</td>
                  <td className="px-4 py-3">
                    <form
                      action={(formData) => {
                        const weight = Number(formData.get("weight"));
                        void mutate(`weight-${item.id}`, () =>
                          updateCrateItemWeight(crateId, item.id, weight),
                        );
                      }}
                      className="flex items-center gap-2"
                    >
                      <input
                        key={`${item.id}-${item.weight}`}
                        name="weight"
                        type="number"
                        min={1}
                        max={1_000_000}
                        required
                        defaultValue={item.weight}
                        aria-label={`Weight for ${item.name}`}
                        className="w-24 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                      />
                      <button
                        type="submit"
                        disabled={busy === `weight-${item.id}`}
                        className="rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-violet-600 disabled:opacity-50"
                      >
                        Save
                      </button>
                    </form>
                  </td>
                  <td className="px-4 py-3 text-emerald-300">{percentage.toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy === `remove-${item.id}`}
                      onClick={() => void mutate(`remove-${item.id}`, () => removeItemFromCrate(crateId, item.id))}
                      className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-10 text-center text-zinc-500">No items in this crate.</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h2 className="font-semibold">Add items</h2>
        <form action={add} className="mt-4 flex flex-wrap items-end gap-3">
          <label className="min-w-[220px] flex-1 space-y-2 text-sm text-zinc-300">
            <span className="block">Item not yet in crate</span>
            <select
              name="itemId"
              required
              disabled={availableItems.length === 0}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white disabled:opacity-50"
            >
              <option value="">Select an item</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </label>
          <label className="w-36 space-y-2 text-sm text-zinc-300">
            <span className="block">Weight</span>
            <input name="weight" type="number" min={1} max={1_000_000} required defaultValue={1} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-white" />
          </label>
          <button type="submit" disabled={availableItems.length === 0 || busy.startsWith("add-")} className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
            Add item
          </button>
        </form>
        {availableItems.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">All existing items are already in this crate.</p>
        )}
      </section>
      {error && <p role="alert" className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">{error}</p>}
    </div>
  );
}
