"use client";

import { useEffect, useState } from "react";
import type { GSIData } from "@/types/gsi";
import type { PubgDailyStats } from "@/lib/services/pubg";

type Props = {
  widget: "now-playing" | "top-clip" | "cs2" | "pubg";
  player: string;
  layout: "bar" | "card";
  refreshSeconds: number;
};

export default function OverlayView({ widget, player, refreshSeconds }: Props) {
  const [cs2, setCs2] = useState<GSIData | null>(null);
  const [pubg, setPubg] = useState<PubgDailyStats | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const endpoint =
      widget === "cs2"
        ? "/api/csdata"
        : `/api/overlays/pubg?player=${encodeURIComponent(player)}`;

    const refresh = async () => {
      if (inFlight || (widget === "pubg" && !player)) return;
      inFlight = true;
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        if (!response.ok) throw new Error(`Overlay request failed: ${response.status}`);
        if (widget === "cs2") {
          const result: { data: GSIData | null } = await response.json();
          if (active) setCs2(result.data);
        } else {
          const result: { stats: PubgDailyStats } = await response.json();
          if (active) setPubg(result.stats);
        }
        if (active) setLoadError(false);
      } catch (error) {
        console.error("Could not refresh game overlay:", error);
        if (active) setLoadError(true);
      } finally {
        inFlight = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), refreshSeconds * 1_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [player, refreshSeconds, widget]);

  const cardClass =
    "overlay-card-enter w-[min(34rem,calc(100vw-2rem))] rounded-2xl border border-violet-300/30 bg-zinc-950/90 p-5 text-white shadow-[0_18px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl";
  const cs2Player = cs2?.player;

  return (
    <main className="overlay-canvas fixed inset-x-0 bottom-0 flex items-end p-5 sm:p-8">
      <section className={cardClass} aria-live="polite" key={widget}>
        {widget === "cs2" ? (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-violet-300">
              Counter-Strike 2 · Live
            </p>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black">
                  {cs2Player?.name || "Čekám na hru…"}
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  {cs2?.map?.name || "Game State Integration"}
                  {cs2?.map?.round ? ` · Kolo ${cs2.map.round}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 gap-5 text-center">
                <Stat label="K" value={cs2Player?.match_stats?.kills} />
                <Stat label="D" value={cs2Player?.match_stats?.deaths} />
                <Stat label="A" value={cs2Player?.match_stats?.assists} />
              </div>
            </div>
            {loadError && <LoadError />}
          </>
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">
              PUBG · Ranked · Dnes
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black">
                  {pubg?.player || player || "Zadej PUBG nickname"}
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Steam · {pubg?.matches ?? 0} ranked zápasů
                </p>
              </div>
              <div className="grid grid-cols-3 gap-x-4 gap-y-3 text-center">
                <Stat label="K/D" value={pubg?.kd} digits={2} />
                <Stat label="Kills" value={pubg?.kills} />
                <Stat label="Deaths" value={pubg?.deaths} />
                <Stat label="Longest kill" value={pubg?.longestKill} digits={1} suffix="m" />
                <Stat label="HS rate" value={pubg?.headshotRate} digits={1} suffix="%" />
                <Stat label="Most damage" value={pubg?.mostDamage} />
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-white/10 pt-3 text-xs text-zinc-300">
              <span>Průměr damage: {pubg?.averageDamage.toLocaleString("cs-CZ") ?? "—"}</span>
              <span>Nejvyšší damage v jednom ranked zápase</span>
            </div>
            {loadError && <LoadError />}
          </>
        )}
      </section>
    </main>
  );
}

function Stat({
  label,
  value,
  digits = 0,
  suffix = "",
}: {
  label: string;
  value: number | null | undefined;
  digits?: number;
  suffix?: string;
}) {
  return (
    <div>
      <p className="text-2xl font-black tabular-nums">
        {value == null ? "—" : `${value.toFixed(digits)}${suffix}`}
      </p>
      <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
        {label}
      </p>
    </div>
  );
}

function LoadError() {
  return (
    <p className="mt-3 text-xs text-red-300">
      Statistiky se nepodařilo načíst. Zkontroluj konfiguraci API.
    </p>
  );
}
