"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { GSIData } from "@/types/gsi";
import type { PubgDailyStats } from "@/lib/services/pubg";
import type { SpotifyPlayback } from "@/lib/services/spotifyService";

type Props = {
  widget: "now-playing" | "spotify" | "top-clip" | "cs2" | "pubg";
  player: string;
  layout: "bar" | "card";
  refreshSeconds: number;
};

export default function OverlayView({ widget, player, refreshSeconds }: Props) {
  const [cs2, setCs2] = useState<GSIData | null>(null);
  const [pubg, setPubg] = useState<PubgDailyStats | null>(null);
  const [spotify, setSpotify] = useState<SpotifyPlayback | null>(null);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    let inFlight = false;
    const endpoint =
      widget === "cs2"
        ? "/api/csdata"
        : widget === "spotify"
          ? "/api/overlays/now-playing"
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
        } else if (widget === "pubg") {
          const result: { stats: PubgDailyStats } = await response.json();
          if (active) setPubg(result.stats);
        } else if (widget === "spotify") {
          const result: { playback: SpotifyPlayback | null } = await response.json();
          if (active) setSpotify(result.playback);
        } else {
          const result: { stats: PubgDailyStats } = await response.json();
          if (active) setPubg(result.stats);
        }
        if (active) setLoadError(false);
      } catch (error) {
        console.error(`Could not refresh ${widget} overlay:`, error);
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
                  {cs2Player?.name || "Waiting for the game…"}
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  {cs2?.map?.name || "Game State Integration"}
                  {cs2?.map?.round ? ` · Round ${cs2.map.round}` : ""}
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
        ) : widget === "spotify" ? (
          <SpotifyOverlay playback={spotify} loadError={loadError} />
        ) : (
          <>
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-amber-300">
              PUBG · Ranked · Today
            </p>
            <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-black">
                  {pubg?.player || player || "Enter a PUBG username"}
                </h1>
                <p className="mt-1 text-sm text-zinc-400">
                  Steam · {pubg?.matches ?? 0} ranked matches
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
              <span>Average damage: {pubg?.averageDamage.toLocaleString("en-US") ?? "—"}</span>
              <span>Highest damage in a single ranked match</span>
            </div>
            {loadError && <LoadError />}
          </>
        )}
      </section>
    </main>
  );
}

function SpotifyOverlay({
  playback,
  loadError,
}: {
  playback: SpotifyPlayback | null;
  loadError: boolean;
}) {
  const track = playback?.item;
  const isPlaying = playback?.is_playing ?? false;
  const artwork = track?.album?.images?.[0]?.url;
  const artists = track?.artists.map((artist) => artist.name).join(", ");

  return (
    <div className="spotify-overlay">
      <div className="spotify-overlay-glow" aria-hidden="true" />
      <div className="relative flex items-center gap-4">
        <div className={`spotify-artwork ${isPlaying ? "is-playing" : ""}`}>
          {artwork ? (
            <Image
              src={artwork}
              alt=""
              width={88}
              height={88}
              unoptimized
              className="h-full w-full rounded-xl object-cover"
            />
          ) : (
            <SpotifyMark />
          )}
          {isPlaying && <span className="spotify-artwork-ring" aria-hidden="true" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="spotify-live-dot" aria-hidden="true" />
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-emerald-300">
              {isPlaying ? "Now playing" : track ? "Paused" : "Spotify"}
            </p>
          </div>
          {track ? (
            <>
              {track.external_urls?.spotify ? (
                <a
                  href={track.external_urls.spotify}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 block truncate text-lg font-bold tracking-tight text-white transition-colors hover:text-emerald-200"
                >
                  {track.name}
                </a>
              ) : (
                <h1 className="mt-2 truncate text-lg font-bold tracking-tight">
                  {track.name}
                </h1>
              )}
              <p className="mt-0.5 truncate text-sm text-zinc-300">
                {artists || "Unknown artist"}
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-zinc-300">
              {loadError ? "Could not connect to Spotify" : "Waiting for a track…"}
            </p>
          )}
          {loadError && track && (
            <p className="mt-1 text-xs text-amber-200">Connection lost · retrying</p>
          )}
        </div>
        <div
          className={`spotify-equalizer ${isPlaying ? "is-playing" : ""}`}
          role="img"
          aria-label={isPlaying ? "Music is playing" : "Music is paused"}
        >
          {[0, 1, 2, 3].map((bar) => (
            <span key={bar} style={{ animationDelay: `${bar * 110}ms` }} />
          ))}
        </div>
      </div>
      <div className="spotify-bottom-line" aria-hidden="true" />
    </div>
  );
}

function SpotifyMark() {
  return (
    <div className="flex h-full w-full items-center justify-center rounded-xl bg-[#1ed760] text-zinc-950">
      <svg viewBox="0 0 24 24" className="h-10 w-10" fill="currentColor" aria-hidden="true">
        <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm4.59 14.42a.75.75 0 0 1-1.03.25c-2.83-1.73-6.4-2.12-10.6-1.16a.75.75 0 1 1-.34-1.46c4.6-1.05 8.55-.6 11.72 1.34.35.22.46.68.25 1.03Zm1.47-3.27a.94.94 0 0 1-1.29.31c-3.24-1.99-8.18-2.56-12.01-1.4a.94.94 0 1 1-.55-1.8c4.38-1.33 9.82-.69 13.54 1.6.44.27.58.85.31 1.29Zm.13-3.4c-3.89-2.31-10.31-2.53-14.02-1.4a1.13 1.13 0 1 1-.66-2.17c4.26-1.29 11.34-1.04 15.82 1.62a1.13 1.13 0 0 1-1.14 1.95Z" />
      </svg>
    </div>
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
      Could not load statistics. Check the API configuration.
    </p>
  );
}
