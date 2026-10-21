"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { SpotifyPlayback } from "@/lib/services/spotifyService";

export default function NowPlayingCard({
  initialPlayback,
  isAdmin,
  spotifyConnected,
}: {
  initialPlayback: SpotifyPlayback | null;
  isAdmin: boolean;
  spotifyConnected: boolean;
}) {
  const [playback, setPlayback] = useState(initialPlayback);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/overlays/now-playing", { cache: "no-store" });
        if (!response.ok) throw new Error(`Overlay request failed: ${response.status}`);
        const result: { playback: SpotifyPlayback | null } = await response.json();
        if (active) setPlayback(result.playback);
      } catch (error) {
        console.error("Could not refresh now-playing overlay:", error);
      }
    };
    const timer = window.setInterval(() => void refresh(), 5_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const track = playback?.is_playing ? playback.item : null;
  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <p className="text-sm font-semibold uppercase tracking-widest text-emerald-300">Now playing</p>
      {track ? (
        <div className="mt-4 flex gap-4">
          {track.album?.images?.[0]?.url && (
            <Image
              src={track.album.images[0].url}
              alt=""
              width={64}
              height={64}
              unoptimized
              className="h-16 w-16 rounded-lg object-cover"
            />
          )}
          <div className="min-w-0">
            <h2 className="truncate font-semibold">{track.name}</h2>
            <p className="mt-1 truncate text-sm text-zinc-400">
              {track.artists.map((artist) => artist.name).join(", ")}
            </p>
            {track.external_urls?.spotify && (
              <a href={track.external_urls.spotify} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-emerald-300 hover:text-emerald-200">
                Open in Spotify
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <p className="text-sm text-zinc-400">No track is currently playing.</p>
          {isAdmin && (
            <a href="/api/auth/spotify/start" className="mt-3 inline-block text-sm font-semibold text-emerald-300 hover:text-emerald-200">
              {spotifyConnected ? "Reconnect Spotify" : "Connect Spotify for the overlay"}
            </a>
          )}
        </div>
      )}
    </article>
  );
}
