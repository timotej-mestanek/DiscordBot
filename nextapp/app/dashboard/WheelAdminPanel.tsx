"use client";

import { useEffect, useMemo, useState } from "react";
import type { WheelConfig, WheelProfileData, WheelSlice } from "@/lib/wheels";

type WheelAdminData = {
  profiles: WheelProfileData[];
  liveGame: { id: string; name: string } | null;
  liveGameUnavailable: boolean;
};

async function fetchWheelAdminData(): Promise<WheelAdminData> {
  const response = await fetch("/api/admin/wheels", { cache: "no-store" });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error ?? "Konfiguráciu kolies sa nepodarilo načítať.");
  }
  return result as WheelAdminData;
}

function createSlice(): WheelSlice {
  return {
    id: crypto.randomUUID().replaceAll("-", ""),
    label: "Nová výhra",
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
      title: `${gameName} koleso`,
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
          : "Konfiguráciu kolies sa nepodarilo načítať.",
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
            : "Konfiguráciu kolies sa nepodarilo načítať.",
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
      setError("Zadaj názov hry a jej číselné Twitch Game ID.");
      return;
    }
    const existing = data.profiles.find((profile) => profile.gameId === normalizedId);
    if (existing) {
      setSelectedId(existing.id);
      setError("");
      setNotice(`Profil hry ${existing.gameName} už existuje.`);
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
        setError(result.error ?? "Konfiguráciu kolies sa nepodarilo uložiť.");
        return;
      }

      setNotice("Konfigurácia kolies bola uložená.");
      await load();
    } catch (saveError) {
      console.error("Wheel admin configuration save failed:", saveError);
      setError("Konfiguráciu kolies sa nepodarilo uložiť.");
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
        setError(result.error ?? "Limit herného kolesa sa nepodarilo resetovať.");
        return;
      }
      setNotice(`Limit kolesa pre ${profile.gameName} bol resetovaný.`);
      await load();
    } catch (resetError) {
      console.error("Wheel game limit reset failed:", resetError);
      setError("Limit herného kolesa sa nepodarilo resetovať.");
    }
  }

  if (loading && !data) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Kolesá šťastia</h2>
        <p className="mt-3 text-sm text-zinc-400">Načítavam konfiguráciu…</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-xl font-semibold">Kolesá šťastia</h2>
        <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-4 rounded-lg border border-zinc-700 px-3 py-2 text-sm"
        >
          Skúsiť znova
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
          <h2 className="text-xl font-semibold">Kolesá šťastia</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-400">
            Nastav výhry, ich váhy, farby a dĺžku animácie. Sub alebo donate
            spúšťa hlavné koleso cez Streamer.bot; výherný VIP segment následne
            roztočí VIP koleso. Herný profil sa vyberie podľa aktuálnej Twitch hry.
          </p>
        </div>
        <a
          href="/overlays/wheel"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-semibold hover:bg-zinc-800"
        >
          Náhľad OBS overlaye
        </a>
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
        <p className="font-semibold">Hra na aktuálnom streame</p>
        {data.liveGame ? (
          <p className="mt-1 text-zinc-300">
            {data.liveGame.name}
            {liveGameProfile
              ? ` · aktívny profil: ${liveGameProfile.config.title}`
              : " · zatiaľ bez herného profilu"}
          </p>
        ) : (
          <p className="mt-1 text-zinc-400">
            {data.liveGameUnavailable
              ? "Twitch hru sa teraz nepodarilo overiť."
              : "Stream je offline alebo Twitch nevrátil kategóriu hry."}
          </p>
        )}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(13rem,0.7fr)_minmax(0,1.5fr)]">
        <div className="space-y-4">
          <label className="block text-sm text-zinc-300">
            Upravované koleso
            <select
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
            >
              <option value="main">Sub a donate</option>
              <option value="vip">VIP koleso</option>
              {gameProfiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.gameName} · herné
                </option>
              ))}
            </select>
          </label>

          <div className="rounded-lg border border-zinc-800 p-4">
            <h3 className="font-semibold">Pridať profil hry</h3>
            {data.liveGame && (
              <button
                type="button"
                onClick={() => addGameProfile(data.liveGame!.id, data.liveGame!.name)}
                className="mt-3 w-full rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold hover:bg-violet-600"
              >
                Pridať aktuálnu hru
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
                placeholder="Názov hry"
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
                Pridať profil
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
                  setNotice("Profil bude odstránený po uložení zmien.");
                }}
                className="mt-4 w-full rounded-lg border border-red-900 px-3 py-2 text-sm text-red-300 hover:bg-red-950/50"
              >
                Odstrániť tento profil hry
              </button>
            )}
            {selectedProfile?.kind === "game" && (
              <div className="mt-4 rounded-lg border border-zinc-800 p-3">
                <p className="text-sm font-medium">
                  Zatočenia: {selectedProfile.spinCount}/{selectedProfile.config.maxSpins ?? 2}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Po dosiahnutí limitu sa koleso zastaví, kým ho moderátor alebo streamer neresetuje.
                </p>
                <button
                  type="button"
                  onClick={() => void resetGameLimit(selectedProfile)}
                  className="mt-3 w-full rounded-lg border border-amber-800 px-3 py-2 text-sm font-semibold text-amber-200 hover:bg-amber-950/50"
                >
                  Resetovať limit zatočení
                </button>
              </div>
            )}
          </div>
        </div>

        {selectedProfile && config ? (
          <div className="min-w-0 space-y-4">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
              <label className="text-sm text-zinc-300">
                Názov kolesa
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
                Trvanie animácie (sekundy)
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
              Koleso zapnuté
            </label>

            {selectedProfile.kind === "game" && (
              <div className="grid gap-3 rounded-lg border border-zinc-800 p-4 sm:grid-cols-2">
                <label className="text-sm text-zinc-300">
                  Maximálny počet zatočení pred resetom
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
                  Mena za otočenie
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
                    <option value="n4jt_points">N4JT Twitch body</option>
                    <option value="channel_points">Twitch Channel Points</option>
                  </select>
                </label>
                <label className="text-sm text-zinc-300">
                  Cena za otočenie
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
                        placeholder="ID odmeny z Twitch / Streamer.bot"
                        className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2"
                      />
                    </label>
                    <p className="text-xs leading-5 text-amber-200 sm:col-span-2">
                      Twitch odmenu nastav na rovnakú cenu a v Streamer.bot spusti
                      koleso pri jej uplatnení. Twitch body sa účtujú priamo na Twitchi.
                    </p>
                  </>
                )}
                {config.pointMode === "n4jt_points" && (
                  <p className="text-xs leading-5 text-zinc-400 sm:col-span-2">
                    Body sa odpočítajú z N4JT Twitch zostatku atomicky pri prijatí
                    požiadavky; neúspešný spin body nestratí.
                  </p>
                )}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold">Výsledky kolieska</h3>
                <p className="text-xs text-zinc-500">
                  Váha určuje pravdepodobnosť výhry; výsledky sa vyžrebujú na serveri.
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
                Pridať výsledok
              </button>
            </div>
            <div className="space-y-3">
              {config.slices.map((slice, index) => (
                <article key={slice.id} className="grid gap-3 rounded-lg border border-zinc-800 p-3 sm:grid-cols-[minmax(0,1fr)_6rem_4rem_auto]">
                  <label className="text-xs text-zinc-400">
                    Výsledok {index + 1}
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
                    Váha
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
                    Farba
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
                    Odobrať
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
                      Po tomto výsledku roztočiť VIP koleso
                    </label>
                  )}
                </article>
              ))}
              {config.slices.length === 0 && (
                <p className="rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-500">
                  Zatiaľ tu nie sú žiadne výsledky. Pridaj aspoň dva, aby sa koleso dalo uložiť a spustiť.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="rounded-lg border border-dashed border-zinc-700 p-5 text-sm text-zinc-500">
            Vybraný profil nie je dostupný.
          </p>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
        <p className="text-xs text-zinc-500">
          Herné profily sa párujú s Twitch Game ID, nie iba s názvom kategórie.
        </p>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
        >
          {saving ? "Ukladám…" : "Uložiť všetky kolesá"}
        </button>
      </div>
    </section>
  );
}
