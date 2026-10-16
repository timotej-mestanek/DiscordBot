"use client";

import { useEffect, useState } from "react";

type SpinCard = {
  id: string;
  displayName: string;
  gameName: string;
  result: string;
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
              className="wheel-result-card-visible rounded-2xl border border-violet-300/30 bg-zinc-950/90 p-5 shadow-[0_20px_70px_rgba(0,0,0,0.65)] backdrop-blur-xl sm:p-6"
            >
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-violet-300">
                {spin.gameName} · {new Date(spin.createdAt).toLocaleTimeString("sk-SK")}
              </p>
              <div className="mt-2 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="truncate text-sm text-zinc-300">{spin.displayName}</p>
                  <h2 className="mt-1 break-words text-2xl font-black sm:text-3xl">
                    {spin.result}
                  </h2>
                </div>
                <span
                  aria-hidden="true"
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-violet-300/40 bg-violet-500/15 text-xl"
                >
                  ★
                </span>
              </div>
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
