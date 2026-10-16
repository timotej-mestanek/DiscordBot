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
  profileId: string | null;
  gameName: string | null;
  spins: SpinCard[] | null;
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
        if (result.spins !== null) {
          if (!result.profileId) {
            throw new Error("Overlay nevrátil identifikátor herného profilu.");
          }
          const profileId = result.profileId;
          const now = Date.now();
          const revealedSpins = result.spins.filter((spin) => {
            const revealAt = Date.parse(spin.revealAt);
            if (!Number.isFinite(revealAt)) {
              throw new Error("Overlay vrátil neplatný čas žrebovania.");
            }
            return now >= revealAt;
          });
          setSpinsByProfile((current) => ({
            ...current,
            [profileId]: revealedSpins,
          }));
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
          : "border-white/50";

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
              className={`wheel-result-card-visible rounded-lg border-2 px-4 py-2 text-center ${rarityBorder(spin.rarity)}`}
            >
              <h2 className="break-words text-2xl font-black sm:text-3xl">{spin.result}</h2>
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
