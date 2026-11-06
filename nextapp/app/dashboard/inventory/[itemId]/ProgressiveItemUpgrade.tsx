"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { upgradeItem } from "@/lib/black-market/actions";
import { errorMessage } from "@/components/black-market/error-messages";

type Level = {
  level: number;
  imageUrl: string;
  upgradeCost: number | null;
  description: string;
};

export default function ProgressiveItemUpgrade({
  accountId,
  item,
  initialGoldenEggs,
}: {
  accountId: string;
  item: {
    id: string;
    name: string;
    currentLevel: number;
    maxLevel: number;
    levels: Level[];
  };
  initialGoldenEggs: number;
}) {
  const [currentLevel, setCurrentLevel] = useState(item.currentLevel);
  const [goldenEggs, setGoldenEggs] = useState(initialGoldenEggs);
  const [selectedLevel, setSelectedLevel] = useState(
    Math.min(item.currentLevel + 1, item.maxLevel),
  );
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState<{ message: string; error: boolean } | null>(
    null,
  );
  const levels = Array.from({ length: item.maxLevel }, (_, index) => {
    const level = index + 1;
    return item.levels.find((entry) => entry.level === level) ?? null;
  });
  const selectedData = levels[selectedLevel - 1] ?? null;
  const isUnlocked = selectedLevel <= currentLevel;
  const canUnlock = selectedLevel === currentLevel + 1;
  const cost = selectedData?.upgradeCost;
  const imageUrl = selectedData?.imageUrl;

  async function unlockSelectedLevel() {
    if (
      pending ||
      !canUnlock ||
      cost === null ||
      cost === undefined ||
      cost <= 0 ||
      goldenEggs < cost
    ) {
      return;
    }

    setPending(true);
    setNotice(null);
    try {
      const result = await upgradeItem(accountId, item.id);
      if (result.type === "error") {
        setNotice({ message: errorMessage(result.code), error: true });
        return;
      }
      setCurrentLevel(result.newLevel);
      setSelectedLevel(result.newLevel);
      setGoldenEggs(result.goldenEggsLeft);
      setNotice({
        message: `Level ${result.newLevel} unlocked for ${item.name}.`,
        error: false,
      });
    } catch (error) {
      console.error("Progressive Black Market upgrade failed:", error);
      setNotice({ message: errorMessage("INTERNAL_ERROR"), error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <section>
      <Link
        href="/dashboard?view=user&tab=inventory"
        className="inline-flex min-h-9 items-center rounded-full bg-zinc-900 px-4 text-sm font-semibold text-zinc-200 hover:bg-zinc-800"
      >
        ← Back to inventory
      </Link>
      <header className="mt-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
            Progressive item
          </p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">{item.name}</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Level {currentLevel} of {item.maxLevel}
          </p>
        </div>
        <p className="rounded-full bg-amber-950/50 px-4 py-2 text-sm font-bold text-amber-200">
          {goldenEggs.toLocaleString("en-US")} 🥚
        </p>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(12rem,1fr)_3fr]">
        <nav
          aria-label="Item levels"
          className="grid max-h-[70dvh] grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-1"
        >
          {levels.map((level, index) => {
            const levelNumber = index + 1;
            const unlocked = levelNumber <= currentLevel;
            const active = selectedLevel === levelNumber;
            return (
              <button
                key={levelNumber}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedLevel(levelNumber)}
                className={`flex min-h-16 items-center gap-2 rounded-xl p-2 text-left transition ${
                  active
                    ? "bg-violet-600/30 ring-1 ring-violet-400"
                    : unlocked
                      ? "bg-zinc-900 hover:bg-zinc-800"
                      : "bg-zinc-950 text-zinc-500 hover:bg-zinc-900"
                }`}
              >
                <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-black/30">
                  {level?.imageUrl ? (
                    <Image
                      src={level.imageUrl}
                      alt=""
                      fill
                      unoptimized
                      sizes="48px"
                      className={`object-cover ${unlocked ? "" : "opacity-35 grayscale"}`}
                    />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold">Level {levelNumber}</span>
                  <span className="block text-[11px] text-zinc-400">
                    {unlocked ? "Unlocked" : "Locked"}
                  </span>
                </span>
                <span className="ml-auto text-sm" aria-hidden="true">
                  {unlocked ? "✓" : "🔒"}
                </span>
              </button>
            );
          })}
        </nav>

        <article className="min-h-[24rem] rounded-2xl bg-zinc-900/70 p-4 sm:p-6">
          <div className="grid h-full gap-5 md:grid-cols-[minmax(0,1.3fr)_minmax(15rem,1fr)]">
            <div className="relative min-h-64 overflow-hidden rounded-xl bg-zinc-950">
              {imageUrl ? (
                <Image
                  src={imageUrl}
                  alt={`${item.name} level ${selectedLevel}`}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 90vw, 55vw"
                  className={`object-contain ${isUnlocked ? "" : "opacity-40 grayscale"}`}
                />
              ) : (
                <div className="flex h-full min-h-64 items-center justify-center text-zinc-600">
                  No preview available
                </div>
              )}
              {!isUnlocked && (
                <span className="absolute inset-0 flex items-center justify-center text-5xl">
                  🔒
                </span>
              )}
            </div>
            <div className="flex flex-col justify-center">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
                {isUnlocked ? "Unlocked" : "Locked"}
              </p>
              <h2 className="mt-2 text-2xl font-black">Level {selectedLevel}</h2>
              {selectedData?.description && (
                <p className="mt-2 text-sm leading-6 text-zinc-300">
                  {selectedData.description}
                </p>
              )}
              {isUnlocked ? (
                <p className="mt-3 text-sm text-emerald-300">
                  This level is already unlocked.
                </p>
              ) : (
                <>
                  <p className="mt-3 text-sm leading-6 text-zinc-300">
                    {canUnlock
                      ? "Unlock this level by spending Golden Eggs."
                      : `Unlock level ${currentLevel + 1} first. This level becomes available afterward.`}
                  </p>
                  <div className="mt-4 rounded-xl bg-zinc-950 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                      {canUnlock ? "Unlock requirement" : "Level requirement"}
                    </p>
                    <p className="mt-2 text-lg font-black text-amber-200">
                      {canUnlock
                        ? levelCostText(selectedData)
                        : `Next: ${levelCostText(levels[currentLevel] ?? null)}`}
                    </p>
                    {canUnlock && cost !== null && cost !== undefined && (
                      <p className="mt-1 text-xs text-zinc-400">
                        Balance after unlock:{" "}
                        {Math.max(0, goldenEggs - cost).toLocaleString("en-US")} 🥚
                      </p>
                    )}
                  </div>
                </>
              )}
              <button
                type="button"
                disabled={
                  pending ||
                  currentLevel >= item.maxLevel ||
                  !canUnlock ||
                  cost === null ||
                  cost === undefined ||
                  cost <= 0 ||
                  goldenEggs < (cost ?? Infinity)
                }
                onClick={() => void unlockSelectedLevel()}
                className="mt-5 min-h-11 rounded-full bg-violet-600 px-5 text-sm font-bold hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
              >
                {pending
                  ? "Unlocking…"
                  : currentLevel >= item.maxLevel
                    ? "MAXED UP"
                    : isUnlocked
                      ? "Unlocked"
                      : !canUnlock
                        ? "Unlock previous levels first"
                        : goldenEggs < (cost ?? Infinity)
                          ? "Not enough Golden Eggs"
                          : `Unlock · ${cost?.toLocaleString("en-US") ?? "—"} 🥚`}
              </button>
            </div>
          </div>
        </article>
      </div>

      {notice && (
        <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:px-6 sm:pb-5">
          <div
            role={notice.error ? "alert" : "status"}
            className={`mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-xl px-5 py-4 text-sm font-bold shadow-2xl ${
              notice.error
                ? "bg-red-500 text-red-950"
                : "bg-emerald-500 text-emerald-950"
            }`}
          >
            <span>{notice.message}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-full bg-black/10 px-3 py-1 hover:bg-black/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function levelCostText(level: Level | null) {
  if (!level) return "Level data unavailable";
  if (level.level === 1) return "Base level";
  if (level.upgradeCost === null || level.upgradeCost <= 0) {
    return "Upgrade cost unavailable";
  }
  return `${level.upgradeCost.toLocaleString("en-US")} Golden Eggs`;
}
