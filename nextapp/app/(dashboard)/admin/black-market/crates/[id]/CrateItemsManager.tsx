"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  addItemToCrate,
  removeItemFromCrate,
  updateCrateItemChance,
} from "@/lib/black-market/admin-actions";

type ItemType = "normal" | "progressive" | "golden_eggs";
type CrateItem = {
  crateItemId: string;
  name: string;
  itemType: ItemType;
  dropChance: number;
  goldenEggs: number | null;
};
type AvailableItem = { id: string; name: string; item_type: ItemType };

function errorText(code: string) {
  const messages: Record<string, string> = {
    FORBIDDEN: "You do not have permission to change crate contents.",
    VALIDATION_ERROR: "Check the drop chance (0–100%, max 2 decimal places) and egg amount. Total crate chance cannot exceed 100%.",
    NOT_FOUND: "The crate or item no longer exists. Refresh and try again.",
    CONFLICT: "That item is already in this crate, or this egg reward amount is already used.",
    INTERNAL_ERROR: "The crate contents could not be updated.",
  };
  return messages[code] ?? "The crate contents could not be updated.";
}

const fieldClass =
  "rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white";

export default function CrateItemsManager({
  crateId,
  totalChance,
  items,
  availableItems,
}: {
  crateId: string;
  totalChance: number;
  items: CrateItem[];
  availableItems: AvailableItem[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [selectedItemId, setSelectedItemId] = useState("");

  const selectedItem = availableItems.find((item) => item.id === selectedItemId);

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
        return false;
      }
      router.refresh();
      return true;
    } catch (requestError) {
      console.error("Black Market crate item update failed:", requestError);
      setError("The crate contents could not be updated.");
      return false;
    } finally {
      setBusy("");
    }
  }

  async function add(formData: FormData) {
    const item = selectedItem;
    const dropChance = Number(formData.get("dropChance"));
    const amount = item?.item_type === "golden_eggs"
      ? Number(formData.get("goldenEggs"))
      : null;
    if (!item) {
      setError("Select an item to add.");
      return;
    }
    if (
      await mutate(`add-${item.id}`, () =>
        addItemToCrate(crateId, item.id, dropChance, amount),
      )
    ) {
      setSelectedItemId("");
    }
  }

  return (
    <div className="space-y-8">
      <section className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <div className="border-b border-zinc-800 px-5 py-4">
          <h2 className="font-semibold">Items in this crate</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Each reward uses its individual drop chance. Unused chance means no reward.
          </p>
          <p className={`mt-2 text-sm font-semibold ${totalChance > 100 ? "text-red-300" : "text-emerald-300"}`}>
            Total: {totalChance.toFixed(2)}% · No reward: {Math.max(0, 100 - totalChance).toFixed(2)}%
          </p>
        </div>
        <table className="w-full min-w-[700px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Item</th>
              <th className="px-4 py-3">Drop chance</th>
              <th className="px-4 py-3">Egg reward</th>
              <th className="px-4 py-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {items.map((item) => {
              const formId = `crate-item-${item.crateItemId}`;
              return (
                <tr key={item.crateItemId}>
                  <td className="px-4 py-3 font-medium text-white">
                    {item.name}
                    {item.itemType === "golden_eggs" && (
                      <span className="ml-2 text-xs text-amber-300">Currency</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <form
                      id={formId}
                      action={(formData) => {
                        const dropChance = Number(formData.get("dropChance"));
                        const goldenEggs = item.itemType === "golden_eggs"
                          ? Number(formData.get("goldenEggs"))
                          : null;
                        void mutate(`save-${item.crateItemId}`, () =>
                          updateCrateItemChance(
                            crateId,
                            item.crateItemId,
                            dropChance,
                            goldenEggs,
                          ),
                        );
                      }}
                      className="flex items-center gap-2"
                    >
                      <label className="flex items-center gap-2">
                        <input
                          key={`${item.crateItemId}-${item.dropChance}`}
                          name="dropChance"
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          required
                          defaultValue={item.dropChance}
                          aria-label={`Drop chance for ${item.name}`}
                          className={`${fieldClass} w-28`}
                        />
                        <span className="text-zinc-400">%</span>
                      </label>
                    </form>
                  </td>
                  <td className="px-4 py-3">
                    {item.itemType === "golden_eggs" ? (
                      <label className="flex items-center gap-2">
                        <span className="sr-only">Egg amount</span>
                        <input
                          key={`${item.crateItemId}-eggs-${item.goldenEggs}`}
                          form={formId}
                          name="goldenEggs"
                          type="number"
                          min={1}
                          max={1_000_000_000}
                          required
                          defaultValue={item.goldenEggs ?? 1}
                          className={`${fieldClass} w-28`}
                        />
                        <span className="text-amber-300">🥚</span>
                      </label>
                    ) : <span className="text-zinc-500">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={busy === `remove-${item.crateItemId}`}
                      onClick={() => void mutate(
                        `remove-${item.crateItemId}`,
                        () => removeItemFromCrate(crateId, item.crateItemId),
                      )}
                      className="rounded-lg border border-red-900 px-3 py-2 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                    >
                      Remove
                    </button>
                    <button
                      type="submit"
                      form={formId}
                      disabled={busy === `save-${item.crateItemId}`}
                      className="ml-2 rounded-lg border border-zinc-700 px-3 py-2 text-xs text-zinc-200 hover:border-violet-600 disabled:opacity-50"
                    >
                      Save
                    </button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-zinc-500">
                  No items in this crate.
                </td>
              </tr>
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
              value={selectedItemId}
              onChange={(event) => setSelectedItemId(event.currentTarget.value)}
              disabled={availableItems.length === 0}
              className={`${fieldClass} w-full disabled:opacity-50`}
            >
              <option value="">Select an item</option>
              {availableItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}{item.item_type === "golden_eggs" ? " (currency — add another reward tier)" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="w-36 space-y-2 text-sm text-zinc-300">
            <span className="block">Drop chance (%)</span>
            <input
              name="dropChance"
              type="number"
              min={0}
              max={100}
              step={0.01}
              required
              defaultValue={1}
              className={`${fieldClass} w-full`}
            />
          </label>
          {selectedItem?.item_type === "golden_eggs" && (
            <label className="w-36 space-y-2 text-sm text-zinc-300">
              <span className="block">Egg amount</span>
              <input
                name="goldenEggs"
                type="number"
                min={1}
                max={1_000_000_000}
                required
                defaultValue={10}
                className={`${fieldClass} w-full`}
              />
            </label>
          )}
          <button
            type="submit"
            disabled={availableItems.length === 0 || busy.startsWith("add-")}
            className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
          >
            Add item
          </button>
        </form>
        {availableItems.length === 0 && (
          <p className="mt-3 text-sm text-zinc-500">All existing items are already in this crate.</p>
        )}
      </section>
      {error && (
        <p role="alert" className="rounded-lg border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
