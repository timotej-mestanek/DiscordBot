"use client";

import { useCallback, useEffect, useState } from "react";

type GameProfile = {
  gameId: string;
  gameName: string;
  spinCount: number;
  title: string;
  enabled: boolean;
  maxSpins?: number;
};

type LiveGame = {
  id: string;
  name: string;
};

type WheelData = {
  profiles: GameProfile[];
  liveGame: LiveGame | null;
  liveGameUnavailable: boolean;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isGameProfile(value: unknown): value is GameProfile {
  if (!isRecord(value) || !isRecord(value.config)) return false;
  return (
    value.kind === "game" &&
    typeof value.gameId === "string" &&
    typeof value.gameName === "string" &&
    typeof value.spinCount === "number" &&
    typeof value.config.title === "string" &&
    typeof value.config.enabled === "boolean" &&
    (value.config.maxSpins === undefined ||
      typeof value.config.maxSpins === "number")
  );
}

function isLiveGame(value: unknown): value is LiveGame {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.name === "string"
  );
}

function parseWheelData(value: unknown): WheelData {
  if (
    !isRecord(value) ||
    !Array.isArray(value.profiles) ||
    !value.profiles.every(isGameProfile) ||
    !(value.liveGame === null || isLiveGame(value.liveGame)) ||
    typeof value.liveGameUnavailable !== "boolean"
  ) {
    throw new Error("The Next.js app returned invalid wheel data.");
  }
  return {
    profiles: value.profiles,
    liveGame: value.liveGame,
    liveGameUnavailable: value.liveGameUnavailable,
  };
}

function getErrorMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.error === "string"
    ? value.error
    : fallback;
}

async function fetchWheelData(): Promise<WheelData> {
  const response = await fetch("/api/admin/wheels", { cache: "no-store" });
  const result: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      getErrorMessage(result, "Could not load wheel status."),
    );
  }
  return parseWheelData(result);
}

export default function StreamDeckPanel() {
  const [data, setData] = useState<WheelData | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchWheelData());
    } catch (loadError) {
      console.error("Stream Deck wheel status load failed:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load wheel status.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetchWheelData()
      .then((wheelData) => {
        if (active) setData(wheelData);
      })
      .catch((loadError: unknown) => {
        if (!active) return;
        console.error("Stream Deck wheel status load failed:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load wheel status.",
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const liveProfile =
    data?.liveGame &&
    data.profiles.find((profile) => profile.gameId === data.liveGame?.id);

  async function resetResults() {
    if (!liveProfile || resetting) return;
    if (
      !window.confirm(
        `Reset the wheel limit and spin history for ${liveProfile.gameName}?`,
      )
    ) {
      return;
    }

    setResetting(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/wheels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset-game-limit",
          gameId: liveProfile.gameId,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        setError(
          getErrorMessage(result, "Could not reset the wheel results."),
        );
        return;
      }
      setData((current) =>
        current
          ? {
              ...current,
              profiles: current.profiles.map((profile) =>
                profile.gameId === liveProfile.gameId
                  ? { ...profile, spinCount: 0 }
                  : profile,
              ),
            }
          : current,
      );
      setNotice(`Wheel results for ${liveProfile.gameName} have been reset.`);
    } catch (resetError) {
      console.error("Stream Deck wheel reset failed:", resetError);
      setError("Could not reset the wheel results.");
    } finally {
      setResetting(false);
    }
  }

  const unavailableActions = [
    { label: "Raffle", icon: "🎟️" },
    { label: "Start a vote", icon: "🗳️" },
    { label: "Confirm wheel result", icon: "🏁" },
  ];

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-6 text-white sm:py-10">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
              N4JT · stream controls
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Stream Deck
            </h1>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || resetting}
            className="min-h-12 rounded-xl border border-zinc-700 px-4 text-sm font-semibold text-zinc-200 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </header>

        <section className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className={`h-3 w-3 rounded-full ${
                data?.liveGame ? "bg-emerald-400" : "bg-zinc-600"
              }`}
            />
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-400">
              {data?.liveGame ? "Stream online" : "Stream offline"}
            </p>
          </div>
          <p className="mt-2 text-xl font-bold">
            {data?.liveGame?.name ?? "No active game"}
          </p>
          {liveProfile && (
            <p className="mt-1 text-sm text-zinc-400">
              {liveProfile.title} · {liveProfile.spinCount} /{" "}
              {liveProfile.maxSpins ?? "∞"} spins
            </p>
          )}
          {!loading && data?.liveGame && !liveProfile && (
            <p className="mt-2 text-sm text-amber-300">
              No wheel profile has been created for this game yet.
            </p>
          )}
          {!loading && data?.liveGameUnavailable && (
            <p className="mt-2 text-sm text-amber-300">
              Could not verify Twitch stream status.
            </p>
          )}
        </section>

        {error && (
          <p
            role="alert"
            className="mb-5 rounded-xl border border-red-900 bg-red-950/60 p-4 text-sm text-red-200"
          >
            {error}
          </p>
        )}
        {notice && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-emerald-900 bg-emerald-950/60 p-4 text-sm text-emerald-200"
          >
            {notice}
          </p>
        )}

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => void resetResults()}
            disabled={!liveProfile || loading || resetting}
            className="col-span-2 flex min-h-44 flex-col items-center justify-center gap-3 rounded-2xl border border-red-700/70 bg-gradient-to-br from-red-950 to-zinc-900 p-5 text-center shadow-lg shadow-red-950/30 transition active:scale-[0.98] hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span aria-hidden="true" className="text-4xl">
              {resetting ? "⏳" : "🔄"}
            </span>
            <span className="text-lg font-black uppercase tracking-wide">
              {resetting ? "Resetting…" : "Reset wheel results"}
            </span>
            <span className="text-xs leading-5 text-zinc-300">
              Resets the spin limit and wheel result history for the active game.
            </span>
          </button>

          {unavailableActions.map((action) => (
            <button
              key={action.label}
              type="button"
              disabled
              title="This server action is not available yet."
              className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 text-center opacity-55"
            >
              <span aria-hidden="true" className="text-3xl grayscale">
                {action.icon}
              </span>
              <span className="text-sm font-bold">{action.label}</span>
              <span className="text-[11px] leading-4 text-zinc-500">
                API is not available yet
              </span>
            </button>
          ))}
        </div>

        <p className="mt-5 text-center text-xs leading-5 text-zinc-500">
          Changes are available only to signed-in administrators. Configure
          game wheels in the{" "}
          <a
            href="/dashboard?tab=admin"
            className="font-semibold text-violet-300 underline underline-offset-2"
          >
            admin panel
          </a>
          .
        </p>
      </div>
    </main>
  );
}
