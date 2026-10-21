"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { WheelConfig, WheelProfileData, WheelSlice } from "@/lib/wheels";
import type { WheelRealtimeEvent } from "@/lib/wheel-realtime";
import useWheelRealtime from "@/app/overlays/useWheelRealtime";

type WheelAdminData = {
  profiles: WheelProfileData[];
  liveGame: { id: string; name: string } | null;
  liveGameUnavailable: boolean;
};

async function fetchWheelAdminData(): Promise<WheelAdminData> {
  const response = await fetch("/api/admin/wheels", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? "Could not load the wheel configuration.");
  }
  return result as WheelAdminData;
}

function createSlice(): WheelSlice {
  return {
    id: crypto.randomUUID().replaceAll("-", ""),
    label: "New prize",
    weight: 1,
    color: "#7c3aed",
    vipTrigger: false,
  };
}

function createGameProfile(gameId: string, gameName: string): WheelProfileData {
  return {
    id: `game:${gameId}`,
    kind: "game",
    gameId,
    gameName,
    config: {
      title: `${gameName} wheel`,
      enabled: false,
      durationMs: 8_000,
      pointMode: "n4jt_points",
      pointCost: 100,
      maxSpins: 2,
      slices: [],
    },
    spinCount: 0,
  };
}

export default function WheelAdminPanel() {
  const [data, setData] = useState<WheelAdminData | null>(null);
  const [selectedId, setSelectedId] = useState("main");
  const [gameName, setGameName] = useState("");
  const [gameId, setGameId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const seenSpinIds = useRef(new Set<string>());
  const resetTimes = useRef(new Map<string, number>());

  const handleWheelRealtimeEvent = useCallback((event: WheelRealtimeEvent) => {
    if (event.type === "reset") {
      resetTimes.current.set(event.profileId, Date.parse(event.resetAt));
      setData((current) =>
        current
          ? {
              ...current,
              profiles: current.profiles.map((profile) =>
                profile.id === event.profileId
                  ? { ...profile, spinCount: 0 }
                  : profile,
              ),
            }
          : current,
      );
      return;
    }
    if (event.type !== "spin" || !event.spin.profile_id.startsWith("game:")) return;
    if (seenSpinIds.current.has(event.spin.id)) return;
    seenSpinIds.current.add(event.spin.id);
    const resetAt = resetTimes.current.get(event.spin.profile_id);
    if (resetAt && Date.parse(event.spin.created_at) <= resetAt) return;
    setData((current) =>
      current
        ? {
            ...current,
            profiles: current.profiles.map((profile) =>
              profile.id === event.spin.profile_id
                ? { ...profile, spinCount: profile.spinCount + 1 }
                : profile,
            ),
          }
        : current,
    );
  }, []);
  useWheelRealtime(handleWheelRealtimeEvent);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setData(await fetchWheelAdminData());
    } catch (loadError) {
      console.error("Wheel admin configuration load failed:", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Could not load the wheel configuration.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    void fetchWheelAdminData()
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch((loadError: unknown) => {
        if (!mounted) return;
        console.error("Wheel admin configuration load failed:", loadError);
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Could not load the wheel configuration.",
        );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const selectedProfile = useMemo(
    () => data?.profiles.find((profile) => profile.id === selectedId) ?? null,
    [data, selectedId],
  );

  function updateConfig(update: (config: WheelConfig) => WheelConfig) {
    if (!data || !selectedProfile) return;
    setData({
      ...data,
      profiles: data.profiles.map((profile) =>
        profile.id === selectedProfile.id
          ? { ...profile, config: update(profile.config) }
          : profile,
      ),
    });
    setNotice("");
  }

  function updateSlice(sliceId: string, update: (slice: WheelSlice) => WheelSlice) {
    updateConfig((config) => ({
      ...config,
      slices: config.slices.map((slice) =>
        slice.id === sliceId ? update(slice) : slice,
      ),
    }));
  }

  function addGameProfile(id: string, name: string) {
    if (!data) return;
    const normalizedId = id.trim();
    const normalizedName = name.trim();
    if (!/^\d{1,32}$/.test(normalizedId) || !normalizedName || normalizedName.length > 100) {
      setError("Enter a game name and its numeric Twitch Game ID.");
      return;
    }
    const existing = data.profiles.find((profile) => profile.gameId === normalizedId);
    if (existing) {
      setSelectedId(existing.id);
      setError("");
      setNotice(`A profile for ${existing.gameName} already exists.`);
      return;
    }
    const profile = createGameProfile(normalizedId, normalizedName);
    setData({ ...data, profiles: [...data.profiles, profile] });
    setSelectedId(profile.id);
    setGameId("");
    setGameName("");
    setError("");
    setNotice("");
  }

  async function save() {
    if (!data) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/wheels", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiles: data.profiles }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not save the wheel configuration.");
        return;
      }

      setNotice("Wheel configuration saved.");
      await load();
    } catch (saveError) {
      console.error("Wheel admin configuration save failed:", saveError);
      setError("Could not save the wheel configuration.");
    } finally {
      setSaving(false);
    }
  }

  async function resetGameLimit(profile: WheelProfileData) {
    if (!profile.gameId) return;
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/admin/wheels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset-game-limit", gameId: profile.gameId }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not reset the game wheel limit.");
        return;
      }
      setNotice(`The wheel limit for ${profile.gameName} has been reset.`);
      setData((current) =>
        current
          ? {
              ...current,
              profiles: current.profiles.map((item) =>
                item.id === profile.id ? { ...item, spinCount: 0 } : item,
              ),
            }
          : current,
      );
    } catch (resetError) {
      console.error("Wheel game limit reset failed:", resetError);
      setError("Could not reset the game wheel limit.");
    }
  }

  if (loading && !data) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Prize wheels</h2>
        <p className="mt-3 text-sm text-zinc-400">Loading configuration…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Prize wheels</h2>
        <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg border border-zinc-700 px-3 py-2 text-sm"
        >
          Try again
        </button>
      </section>
    );
  }

  const config = selectedProfile?.config;
  const gameProfiles = data.profiles.filter((profile) => profile.kind === "game");
  const liveGameProfile = data.liveGame
    ? gameProfiles.find((profile) => profile.gameId === data.liveGame?.id)
    : null;

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Prize wheels</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Configure prizes, weights, colors, and animation duration. A sub or donation
            starts the main wheel via Streamer.bot; landing on a VIP segment then
            spins the VIP wheel. The game profile is selected based on the current Twitch game.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href="/overlays/wheel"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold hover:bg-zinc-800"
          >
            Wheel animation preview
          </a>
          <a
            href="/overlays/wheel-history"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-violet-800 px-3 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-950/50"
          >
            Spin history preview
          </a>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/40 p-3 text-sm text-emerald-200">
          {notice}
        </p>
      )}

      <div className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-4 text-sm">
        <p className="font-semibold">Game on the current stream</p>
        {data.liveGame ? (
          <p className="mt-1 text-zinc-300">
            {data.liveGame.name}
            {liveGameProfile
              ? ` · active profile: ${liveGameProfile.config.title}`
              : " · no game profile yet"}
          </p>
        ) : (
          <p className="mt-1 text-zinc-400">
            {data.liveGameUnavailable
              ? "Could not verify the Twitch game."
              : "The stream is offline or Twitch did not return a game category."}
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(13rem,0.7fr)_minmax(0,1.5fr)]">
        <div className="space-y-4">
          <label className="block text-sm text-zinc-300">
            Wheel to edit
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              <option value="main">Sub a donate</option>
              <option value="vip">VIP wheel</option>
              {gameProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.gameName} · game
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-zinc-800 p-4">
            <h3 className="font-semibold">Add a game profile</h3>
            {data.liveGame && (
              <button
                type="button"
                onClick={() => addGameProfile(data.liveGame!.id, data.liveGame!.name)}
                className="mt-3 w-full rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold hover:bg-violet-600"
              >
                Add current game
              </button>
            )}
            <form
              className="mt-3 space-y-2"
              onSubmit={(event) => {
                event.preventDefault();
                addGameProfile(gameId, gameName);
              }}
            >
              <input
                value={gameName}
                onChange={(event) => setGameName(event.target.value)}
                maxLength={100}
                placeholder="Game name"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
              <input
                value={gameId}
                onChange={(event) => setGameId(event.target.value)}
                inputMode="numeric"
                placeholder="Twitch Game ID"
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
              />
              <button className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800">
                Add profile
              </button>
            </form>
            {selectedProfile?.kind === "game" && (
              <button
                type="button"
                onClick={() => {
                  setData({
                    ...data,
                    profiles: data.profiles.filter((profile) => profile.id !== selectedProfile.id),
                  });
                  setSelectedId("main");
                  setNotice("The profile will be removed after saving changes.");
                }}
                className="mt-4 w-full rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950/50"
              >
                Remove this game profile
              </button>
            )}
            {selectedProfile?.kind === "game" && (
              <div className="mt-4 rounded-lg border border-zinc-800 p-3">
                <p className="text-sm font-medium">
                  Spins: {selectedProfile.spinCount}/{selectedProfile.config.maxSpins ?? 2}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Once the limit is reached, the wheel stops until a moderator or streamer resets it.
                </p>
                <button
                  type="button"
                  onClick={() => void resetGameLimit(selectedProfile)}
                  className="mt-3 w-full rounded-lg border border-amber-800 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-950/50"
                >
                  Reset spin limit
                </button>
              </div>
            )}
          </div>
        </div>

        {selectedProfile && config ? (
          <div className="min-w-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <label className="text-sm text-zinc-300">
                Wheel title
                <input
                  value={config.title}
                  maxLength={80}
                  onChange={(event) =>
                    updateConfig((current) => ({ ...current, title: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                />
              </label>
              <label className="text-sm text-zinc-300">
                Animation duration (seconds)
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={config.durationMs / 1_000}
                  onChange={(event) =>
                    updateConfig((current) => ({
                      ...current,
                      durationMs: Number(event.target.value) * 1_000,
                    }))
                  }
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm text-zinc-300">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(event) =>
                  updateConfig((current) => ({ ...current, enabled: event.target.checked }))
                }
              />
              Wheel enabled
            </label>

            {selectedProfile.kind === "game" && (
              <div className="grid gap-3 rounded-lg border border-zinc-800 p-4 sm:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  Maximum spins before reset
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={config.maxSpins ?? 2}
                    onChange={(event) =>
                      updateConfig((current) => ({
                        ...current,
                        maxSpins: Number(event.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                  />
                </label>
                <label className="text-sm text-zinc-300">
                  Currency per spin
                  <select
                    value={config.pointMode ?? "n4jt_points"}
                    onChange={(event) =>
                      updateConfig((current) => ({
                        ...current,
                        pointMode: event.target.value as "channel_points" | "n4jt_points",
                        channelRewardId:
                          event.target.value === "channel_points"
                            ? current.channelRewardId ?? ""
                            : undefined,
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                  >
                    <option value="n4jt_points">N4JT Twitch points</option>
                    <option value="channel_points">Twitch Channel Points</option>
                  </select>
                </label>
                <label className="text-sm text-zinc-300">
                  Cost per spin
                  <input
                    type="number"
                    min={1}
                    max={1_000_000}
                    value={config.pointCost ?? ""}
                    onChange={(event) =>
                      updateConfig((current) => ({
                        ...current,
                        pointCost: Number(event.target.value),
                      }))
                    }
                    className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                  />
                </label>
                {config.pointMode === "channel_points" && (
                  <>
                    <label className="text-sm text-zinc-300 sm:col-span-2">
                      Twitch reward ID
                      <input
                        value={config.channelRewardId ?? ""}
                        maxLength={100}
                        onChange={(event) =>
                          updateConfig((current) => ({
                            ...current,
                            channelRewardId: event.target.value,
                          }))
                        }
                        placeholder="Reward ID from Twitch / Streamer.bot"
                        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                      />
                    </label>
                    <p className="text-xs leading-5 text-amber-200 sm:col-span-2">
                      Set the Twitch reward to the same cost and trigger the wheel in
                      Streamer.bot when it is redeemed. Twitch points are charged directly by Twitch.
                    </p>
                  </>
                )}
                {config.pointMode === "n4jt_points" && (
                  <p className="text-xs leading-5 text-zinc-400 sm:col-span-2">
                    Points are atomically deducted from the N4JT Twitch balance when the
                    request is accepted; a failed spin does not consume points.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Wheel outcomes</h3>
                <p className="text-xs text-zinc-500">
                  Weight is the relative number of raffle tickets, not a percentage.
                  For example, weights 1 and 3 give chances of 25% and 75%.
                  Decimals are unnecessary: a 0.5 : 1.5 ratio is the same as 1 : 3.
                  In game wheels, already selected outcomes are removed until reset,
                  and weights are recalculated among the remaining outcomes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => updateConfig((current) => ({
                  ...current,
                  slices: [...current.slices, createSlice()],
                }))}
                disabled={config.slices.length >= 24}
                className="shrink-0 rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-50"
              >
                Add outcome
              </button>
            </div>
            <div className="space-y-3">
              {config.slices.map((slice, index) => (
                <article key={slice.id} className="grid gap-3 rounded-lg border border-zinc-800 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_4rem_auto]">
                  <label className="text-xs text-zinc-400">
                    Outcome {index + 1}
                    <input
                      value={slice.label}
                      maxLength={80}
                      onChange={(event) =>
                        updateSlice(slice.id, (current) => ({
                          ...current,
                          label: event.target.value,
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-400">
                    Weight
                    <span className="mt-1 block text-[11px] text-zinc-500">
                      Integer 1–10,000 · higher number = higher chance
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={10_000}
                      value={slice.weight}
                      onChange={(event) =>
                        updateSlice(slice.id, (current) => ({
                          ...current,
                          weight: Number(event.target.value),
                        }))
                      }
                      className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    />
                  </label>
                  <label className="text-xs text-zinc-400">
                    Color
                    <input
                      type="color"
                      value={slice.color}
                      onChange={(event) =>
                        updateSlice(slice.id, (current) => ({
                          ...current,
                          color: event.target.value,
                        }))
                      }
                      className="mt-1 h-10 w-full rounded-lg border border-zinc-700 bg-zinc-950 p-1"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      updateConfig((current) => ({
                        ...current,
                        slices: current.slices.filter((item) => item.id !== slice.id),
                      }))
                    }
                    className="self-end rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-red-800 hover:text-red-300"
                  >
                    Remove
                  </button>
                  {selectedProfile.kind === "main" && (
                    <label className="flex items-center gap-2 text-xs text-amber-200 sm:col-span-4">
                      <input
                        type="checkbox"
                        checked={slice.vipTrigger}
                        onChange={(event) =>
                          updateConfig((current) => ({
                            ...current,
                            slices: current.slices.map((item) => ({
                              ...item,
                              vipTrigger: item.id === slice.id && event.target.checked,
                            })),
                          }))
                        }
                      />
                      Spin the VIP wheel after this outcome
                    </label>
                  )}
                </article>
              ))}
              {config.slices.length === 0 && (
                <p className="rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-500">
                  There are no outcomes yet. Add at least two to save and spin the wheel.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-500">
            The selected profile is unavailable.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500">
          Game profiles are matched by Twitch Game ID, not just the category name.
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save all wheels"}
        </button>
      </div>
    </section>
  );
}
