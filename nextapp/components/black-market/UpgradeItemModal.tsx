"use client";

import Image from "next/image";
import { useState } from "react";
import type { BlackMarketInventoryItem } from "./types";

export default function UpgradeItemModal({
  item,
  goldenEggs,
  onClose,
  onConfirm,
}: {
  item: BlackMarketInventoryItem;
  goldenEggs: number;
  onClose: () => void;
  onConfirm: (item: BlackMarketInventoryItem) => Promise<boolean>;
}) {
  const [pending, setPending] = useState(false);
  const nextLevel = item.levels.find(
    (level) => level.level === item.currentLevel + 1,
  );
  const isMaxLevel = item.currentLevel >= item.maxLevel;
  const cost = nextLevel?.upgradeCost;

  async function confirm() {
    if (pending || !nextLevel || cost === null || cost === undefined) return;
    setPending(true);
    const success = await onConfirm(item);
    setPending(false);
    if (success) onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-item-title"
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
              Upgrade item
            </p>
            <h2 id="upgrade-item-title" className="mt-2 text-2xl font-black">
              {item.name}
            </h2>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Close
          </button>
        </div>

        {isMaxLevel ? (
          <p className="my-10 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-center font-bold text-zinc-400">
            MAX LEVEL
          </p>
        ) : nextLevel ? (
          <>
            <div className="relative mt-5 aspect-square overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
              {nextLevel.imageUrl ? (
                <Image
                  src={nextLevel.imageUrl}
                  alt={`${item.name} level ${nextLevel.level}`}
                  fill
                  unoptimized
                  sizes="400px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-5xl text-zinc-700" aria-hidden="true">◇</div>
              )}
            </div>
            <p className="mt-4 text-center font-semibold">
              Level {nextLevel.level}
            </p>
            <p className="mt-1 text-center text-sm text-amber-200">
              Upgrade cost: {cost?.toLocaleString("en-US") ?? "Unavailable"} 🥚
            </p>
            <p className="mt-1 text-center text-xs text-zinc-500">
              Balance: {goldenEggs.toLocaleString("en-US")} 🥚
            </p>
          </>
        ) : (
          <p className="my-10 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-center text-sm text-zinc-400">
            Upgrade data for the next level is unavailable.
          </p>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            disabled={
              pending ||
              isMaxLevel ||
              !nextLevel ||
              cost === null ||
              cost === undefined ||
              cost <= 0 ||
              goldenEggs < (cost ?? Infinity)
            }
            onClick={() => void confirm()}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? "Upgrading…"
              : isMaxLevel
                ? "MAX LEVEL"
                : `Upgrade (${cost?.toLocaleString("en-US") ?? "—"} 🥚)`}
          </button>
        </div>
      </section>
    </div>
  );
}
