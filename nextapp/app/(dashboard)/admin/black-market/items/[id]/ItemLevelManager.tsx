"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ImageUpload from "@/components/admin/ImageUpload";
import {
  deleteItemLevel,
  upsertItemLevel,
} from "@/lib/black-market/admin-actions";

type ItemLevel = { level: number; upgradeCost: number | null; imageUrl: string };

export default function ItemLevelManager({
  itemId,
  maxLevel,
  levels,
  editLevel,
}: {
  itemId: string;
  maxLevel: number;
  levels: ItemLevel[];
  editLevel?: ItemLevel;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const existing = new Set(levels.map((level) => level.level));
  const initialLevel = editLevel?.level ??
    Array.from({ length: maxLevel }, (_, index) => index + 1).find((level) => !existing.has(level)) ??
    1;
  const [level, setLevel] = useState(initialLevel);
  const [imageUrl, setImageUrl] = useState(editLevel?.imageUrl ?? "");

  async function save(formData: FormData) {
    setBusy(true);
    setError("");
    const savedLevel = editLevel ? editLevel.level : Number(formData.get("level"));
    const costInput = String(formData.get("upgradeCost") ?? "").trim();
    const result = await upsertItemLevel({
      itemId,
      level: savedLevel,
      upgradeCost: savedLevel === 1 ? null : Number(costInput),
      imageUrl,
    }).catch((saveError: unknown) => {
      console.error("Black Market item level save failed:", saveError);
      return null;
    });
    if (!result) {
      setError("The level could not be saved.");
    } else if (result.type === "error") {
      const messages: Record<string, string> = {
        FORBIDDEN: "You do not have permission to change levels.",
        VALIDATION_ERROR: "Check the selected level, upgrade cost, and image.",
        NOT_FOUND: "This item no longer exists. Refresh and try again.",
        CONFLICT: "That item level already exists.",
        CONFIRMATION_REQUIRED: "Confirm the deletion to continue.",
        INTERNAL_ERROR: "The level could not be saved.",
      };
      setError(messages[result.code] ?? "The level could not be saved.");
    } else {
      setOpen(false);
      router.refresh();
    }
    setBusy(false);
  }

  async function remove() {
    if (!editLevel) return;
    const warning = editLevel.level === 1
      ? " Level 1 is the base item image; crate openings that award this item may fail until another level 1 is added."
      : "";
    if (!window.confirm(`Delete level ${editLevel.level}?${warning}`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await deleteItemLevel(itemId, editLevel.level);
      if (result.type === "error") {
        setError(result.code === "FORBIDDEN" ? "You do not have permission." : "The level could not be deleted.");
      } else {
        setOpen(false);
        router.refresh();
      }
    } catch (removeError) {
      console.error("Black Market item level deletion failed:", removeError);
      setError("The level could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={!editLevel && levels.length >= maxLevel}
        onClick={() => {
          setError("");
          setOpen(true);
        }}
        className={editLevel
          ? "rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-zinc-500"
          : "rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"}
      >
        {editLevel ? "Edit" : "Add level"}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
          <form action={save} className="w-full max-w-xl space-y-5 rounded-2xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold">{editLevel ? `Edit level ${editLevel.level}` : "Add item level"}</h2>
                <p className="mt-1 text-sm text-zinc-400">Upload the image shown at this level.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-zinc-400 hover:text-white">✕</button>
            </div>
            <label className="space-y-2 text-sm text-zinc-300">
              <span className="block">Level</span>
              {editLevel ? (
                <input value={editLevel.level} readOnly className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-zinc-500" />
              ) : (
                <select
                  name="level"
                  value={level}
                  onChange={(event) => setLevel(Number(event.currentTarget.value))}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                >
                  {Array.from({ length: maxLevel }, (_, index) => index + 1)
                    .filter((entry) => !existing.has(entry))
                    .map((entry) => <option key={entry} value={entry}>{entry}</option>)}
                </select>
              )}
            </label>
            {level === 1 && (
              <p className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
                Level 1 is the base level; it has no upgrade cost.
              </p>
            )}
            {level > 1 && (
              <label className="space-y-2 text-sm text-zinc-300">
                <span className="block">Upgrade cost (golden eggs)</span>
                <input
                  name="upgradeCost"
                  type="number"
                  min={1}
                  max={1_000_000_000}
                  required
                  defaultValue={editLevel?.upgradeCost ?? ""}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
                />
              </label>
            )}
            <ImageUpload type="item-level" label="Level image" value={imageUrl} onChange={setImageUrl} />
            {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
            <div className="flex flex-wrap justify-end gap-2 border-t border-zinc-800 pt-4">
              {editLevel && (
                <button type="button" disabled={busy} onClick={() => void remove()} className="mr-auto rounded-lg border border-red-900 px-4 py-2 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50">
                  Delete level
                </button>
              )}
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-200">Cancel</button>
              <button type="submit" disabled={busy || (!editLevel && existing.size >= maxLevel)} className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50">
                {busy ? "Saving…" : "Save level"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
