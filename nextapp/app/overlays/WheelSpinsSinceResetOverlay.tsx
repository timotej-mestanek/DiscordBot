"use client";

import { useEffect, useState } from "react";

type SpinCard = {
  id: string;
  displayName: string;
  gameName: string;
  result: string;
  rarity: number;
  createdAt: string;
  revealAt: string;
};

type SpinsSinceResetResponse = {
  profiles: {
    profileId: string;
    gameName: string;
    spins: SpinCard[];
  }[] | null;
  error?: string;
};

export default function WheelSpinsSinceResetOverlay() {
  const [spinsByProfile, setSpinsByProfile] = useState<Record<string, SpinCard[]>>({});
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let mounted = true;
    let loading = false;
    const refresh = async () => {
      if (loading) return;
      loading = true;
      try {
        const response = await fetch("/api/overlays/wheels/spins-since-reset", {
          cache: "no-store",
        });
        const result: SpinsSinceResetResponse = await response.json();
        if (!response.ok) {
          throw new Error(result.error ?? "Históriu herného kolesa sa nepodarilo načítať.");
        }
        if (!mounted) return;
        setLoadError("");
        if (result.profiles !== null) {
          const now = Date.now();
          const updatedProfiles = result.profiles.map((profile) => ({
            profileId: profile.profileId,
            spins: profile.spins.filter((spin) => {
              const revealAt = Date.parse(spin.revealAt);
              if (!Number.isFinite(revealAt)) {
                throw new Error("Overlay vrátil neplatný čas žrebovania.");
              }
              return now >= revealAt;
            }),
          }));
          setSpinsByProfile((current) => {
            const updated = { ...current };
            for (const profile of updatedProfiles) {
              updated[profile.profileId] = profile.spins;
            }
            return updated;
          });
        }
      } catch (error) {
        console.error("Wheel spins since reset overlay refresh failed:", error);
        if (mounted) {
          setLoadError(
            error instanceof Error
              ? error.message
              : "Históriu herného kolesa sa nepodarilo načítať.",
          );
        }
      } finally {
        loading = false;
      }
    };

    void refresh();
    const timer = window.setInterval(() => void refresh(), 1_500);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const spins = Object.values(spinsByProfile)
    .flat()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const rarityBorder = (rarity: number) =>
    rarity <= 0.05
      ? "border-fuchsia-300"
      : rarity <= 0.1
        ? "border-violet-300"
        : rarity <= 0.2
          ? "border-sky-300"
          : "border-white/60";

  return (
    <main className="wheel-history-canvas pointer-events-none fixed inset-0 flex items-end justify-center overflow-hidden p-6 text-white sm:p-10">
      {(spins.length > 0 || loadError) && (
        <section
          aria-label="Výsledky herného kolesa od posledného resetu"
          className="mb-2 flex max-h-[min(70vh,48rem)] w-[min(34rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-auto"
        >
          {[...spins].reverse().map((spin) => (
            <article
              key={spin.id}
              aria-live="polite"
              className={`wheel-result-card-visible flex items-center justify-between gap-4 rounded-xl border-2 bg-zinc-950/90 px-5 py-3 text-left backdrop-blur-sm ${rarityBorder(spin.rarity)}`}
            >
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-300">
                  Wheel win
                </p>
                <h2 className="break-words text-2xl font-black leading-tight text-white sm:text-3xl">
                  {spin.result}
                </h2>
              </div>
              <span className="hidden max-w-32 shrink-0 truncate text-sm font-bold text-zinc-200 sm:block">
                {spin.displayName}
              </span>
            </article>
          ))}
          {loadError && (
            <p role="alert" className="rounded-xl bg-zinc-950/90 p-4 text-sm text-red-200">
              {loadError}
            </p>
          )}
        </section>
      )}
    </main>
  );
}
