"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  createItem,
  deleteItem,
  updateItem,
} from "@/lib/black-market/admin-actions";
import type { AdminActionResult } from "@/lib/black-market/admin-actions";

export type AdminItem = {
  id: string;
  name: string;
  group: string;
  maxLevel: number;
  ownedCount: number;
};

function actionError(result: AdminActionResult<unknown>) {
  if (result.type === "success") return "";
  const messages: Record<string, string> = {
    FORBIDDEN: "You do not have permission to change items.",
    VALIDATION_ERROR: "Check the item ID, name, group, and maximum level.",
    NOT_FOUND: "This item no longer exists. Refresh and try again.",
    CONFLICT: "An item with this ID already exists.",
    CONFIRMATION_REQUIRED: "Confirm the deletion to continue.",
    INTERNAL_ERROR: "The item could not be saved.",
  };
  return messages[result.code];
}

export default function ItemManager({ item }: { item?: AdminItem }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [ownedCount, setOwnedCount] = useState(item?.ownedCount ?? 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function save(formData: FormData) {
    setBusy(true);
    setError("");
    const input = {
      id: String(formData.get("id") ?? "").trim(),
      name: String(formData.get("name") ?? "").trim(),
      group: String(formData.get("group") ?? "").trim().toLowerCase(),
      maxLevel: Number(formData.get("maxLevel")),
    };
    try {
      const result = item ? await updateItem(item.id, input) : await createItem(input);
      const message = actionError(result);
      if (message) {
        setError(message);
        return;
      }
      setOpen(false);
      router.refresh();
    } catch (saveError) {
      console.error("Black Market item save failed:", saveError);
      setError("The item could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!item || (ownedCount > 0 && !confirmDelete)) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteItem(item.id, confirmDelete);
      if (result.type === "error" && result.code === "CONFIRMATION_REQUIRED") {
        setOwnedCount(result.data.ownedCount);
        setConfirmDelete(true);
        return;
      }
      const message = actionError(result);
      if (message) {
        setError(message);
        return;
      }
      setConfirmDelete(false);
      setOpen(false);
      router.refresh();
    } catch (removeError) {
      console.error("Black Market item deletion failed:", removeError);
      setError("The item could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={item
          ? "rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500"
          : "rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500"}
      >
        {item ? "Edit" : "Create Item"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form
            action={save}
            className="w-full max-w-xl space-y-5 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{item ? "Edit item" : "Create item"}</h2>
                <p className="mt-1 text-sm text-zinc-400">Level images are managed separately.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">ID (slug)</span>
                <input
                  name="id"
                  required
                  maxLength={64}
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  readOnly={!!item}
                  defaultValue={item?.id}
                  placeholder="golden-crown"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white read-only:text-zinc-500"
                />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">Name</span>
                <input name="name" required maxLength={100} defaultValue={item?.name} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">Group</span>
                <input name="group" required maxLength={32} pattern="[a-zA-Z0-9_-]+" defaultValue={item?.group ?? "chat"} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
                <span className="block text-xs text-zinc-500">For example: chat</span>
              </label>
              <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">Maximum level</span>
                <input name="maxLevel" type="number" min={1} max={100} required defaultValue={item?.maxLevel ?? 6} className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white" />
              </label>
            </div>
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 pt-4">
              {item && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => ownedCount > 0 ? setConfirmDelete(true) : void remove()}
                  className="mr-auto rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                >
                  Delete
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200">
                Cancel
              </button>
              <button type="submit" disabled={busy} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
                {busy ? "Saving…" : "Save item"}
              </button>
            </div>
          </form>
          {confirmDelete && item && (
            <div role="dialog" aria-modal="true" aria-labelledby="delete-item-title" className="fixed inset-0 z-10 flex items-center justify-center bg-black/80 p-4">
              <div className="w-full max-w-lg space-y-4 rounded-2xl border border-red-900 bg-zinc-900 p-6 shadow-2xl">
                <h3 id="delete-item-title" className="text-xl font-bold text-red-200">Delete an owned item?</h3>
                <p className="text-sm leading-6 text-zinc-300">
                  <strong>{ownedCount} user{ownedCount === 1 ? "" : "s"}</strong> currently own this item. Deleting it permanently removes it from their inventories, removes it from crates, and deletes all level data.
                </p>
                {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
                <div className="flex justify-end gap-2">
                  <button type="button" disabled={busy} onClick={() => setConfirmDelete(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200">
                    Keep item
                  </button>
                  <button type="button" disabled={busy} onClick={() => void remove()} className="rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-50">
                    {busy ? "Deleting…" : "Delete item and owned copies"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
