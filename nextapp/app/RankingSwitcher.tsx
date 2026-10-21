"use client";

import { useCallback, useEffect, useState } from "react";

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

type Rankings = Record<RankingMode, RankingEntry[]>;

export default function RankingSwitcher({
  rankings: initialRankings,
}: {
  rankings: Rankings;
}) {
  const [activeMode, setActiveMode] = useState<RankingMode>("overall");
  const [rankings, setRankings] = useState(initialRankings);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState("");
  const ranking = rankings[activeMode];

  const refreshRankings = useCallback(async () => {
    try {
      const response = await fetch("/api/points/ranking", {
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Ranking refresh failed with HTTP ${response.status}.`);
      }
      const result: unknown = await response.json();
      if (
        typeof result !== "object" ||
        result === null ||
        !("overall" in result) ||
        !("twitch" in result) ||
        !("discord" in result) ||
        !Array.isArray(result.overall) ||
        !Array.isArray(result.twitch) ||
        !Array.isArray(result.discord) ||
        !("updatedAt" in result) ||
        typeof result.updatedAt !== "string"
      ) {
        throw new Error("Ranking refresh returned an invalid response.");
      }
      setRankings({
        overall: result.overall as RankingEntry[],
        twitch: result.twitch as RankingEntry[],
        discord: result.discord as RankingEntry[],
      });
      setUpdatedAt(result.updatedAt);
      setRefreshError("");
    } catch (error) {
      console.error("Point ranking refresh failed:", error);
      setRefreshError("Live ranking could not be refreshed. Showing the last available data.");
    }
  }, []);

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => void refreshRankings(), 0);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshRankings();
    }, 30_000);
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshRankings();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshRankings]);

  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-7">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">Community</p>
          <h2 className="mt-2 text-2xl font-bold">Points leaderboard</h2>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-2">
          <a href="/leaderboards" className="text-sm font-semibold text-violet-300 hover:text-violet-200">
            All leaderboards →
          </a>
          <a href="/dashboard?tab=points" className="text-sm font-semibold text-zinc-400 hover:text-zinc-200">
            My points and conversions →
          </a>
        </div>
      </div>
      <nav aria-label="Leaderboard type" className="mt-5 flex gap-2">
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
        Overall combines Discord points and Twitch CustomBody linked to the same account. Twitch Channel Points are not available.
      </p>
      {refreshError ? (
        <p role="status" className="mt-3 text-xs text-amber-300">
          {refreshError}
        </p>
      ) : updatedAt ? (
        <p className="mt-3 text-xs text-zinc-500">
          Live · updated {new Date(updatedAt).toLocaleTimeString("en-GB")}
        </p>
      ) : (
        <p className="mt-3 text-xs text-zinc-500">Refreshing live ranking…</p>
      )}
      <ol className="mt-5 divide-y divide-zinc-800">
        {ranking.map((entry, index) => (
          <li key={`${entry.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
            <span className="flex items-center gap-3">
              <span className="w-7 text-sm font-bold text-zinc-500">{index + 1}.</span>
              <span className="font-medium">{entry.name}</span>
            </span>
            <span className="font-semibold tabular-nums">{entry.points.toLocaleString("en-US")}</span>
          </li>
        ))}
        {ranking.length === 0 && (
          <li className="py-5 text-sm text-zinc-500">No points yet.</li>
        )}
      </ol>
    </section>
  );
}
