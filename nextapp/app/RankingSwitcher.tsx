"use client";

import { useState } from "react";

type RankingEntry = {
  name: string;
  points: number;
};

type RankingMode = "overall" | "twitch" | "discord";

const modes: Array<{ id: RankingMode; label: string }> = [
  { id: "overall", label: "Overall" },
  { id: "twitch", label: "Twitch CustomBody" },
  { id: "discord", label: "Discord" },
];

export default function RankingSwitcher({
  rankings,
}: {
  rankings: Record<RankingMode, RankingEntry[]>;
}) {
  const [activeMode, setActiveMode] = useState<RankingMode>("overall");
  const ranking = rankings[activeMode];

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">Komunita</p>
          <h2 className="mt-2 text-2xl font-bold">Bodový ranking</h2>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href="/leaderboards" className="text-sm font-semibold text-violet-300 hover:text-violet-200">
            Všechny žebříčky →
          </a>
          <a href="/dashboard?tab=points" className="text-sm font-semibold text-zinc-400 hover:text-zinc-200">
            Moje body a konverze →
          </a>
        </div>
      </div>
      <nav aria-label="Typ bodového rankingu" className="mt-5 flex gap-2">
        {modes.map((mode) => (
          <button
            key={mode.id}
            type="button"
            aria-pressed={activeMode === mode.id}
            onClick={() => setActiveMode(mode.id)}
            className={`rounded-lg px-3 py-2 text-sm ${
              activeMode === mode.id
                ? "bg-violet-600 font-semibold text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            {mode.label}
          </button>
        ))}
      </nav>
      <p className="mt-3 text-xs text-zinc-500">
        Overall sčítá Discord body a Twitch CustomBody propojené s jedním účtem. Twitch Channel Points nejsou dostupné.
      </p>
      <ol className="mt-5 divide-y divide-zinc-800">
        {ranking.map((entry, index) => (
          <li key={`${entry.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-3">
              <span className="w-7 text-sm font-bold text-zinc-500">{index + 1}.</span>
              <span className="font-medium">{entry.name}</span>
            </span>
            <span className="font-semibold tabular-nums">{entry.points.toLocaleString("cs-CZ")}</span>
          </li>
        ))}
        {ranking.length === 0 && (
          <li className="py-5 text-sm text-zinc-500">Zatím tu nejsou žádné body.</li>
        )}
      </ol>
    </section>
  );
}
