"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import NowPlayingCard from "@/app/NowPlayingCard";
import type { SpotifyPlayback } from "@/lib/services/spotifyService";

const StreamStatusContext = createContext<boolean | null>(null);

export function StreamStatusProvider({
  initialStatus,
  children,
}: {
  initialStatus: boolean | null;
  children: ReactNode;
}) {
  const [isLive, setIsLive] = useState(initialStatus);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const response = await fetch("/api/twitch/live", { cache: "no-store" });
        if (!response.ok) throw new Error(`Twitch status request failed: ${response.status}`);
        const result: { isLive: boolean } = await response.json();
        if (active) setIsLive(result.isLive);
      } catch (error) {
        console.error("Could not refresh Twitch live status:", error);
        if (active) setIsLive(null);
      }
    };
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <StreamStatusContext.Provider value={isLive}>
      {children}
    </StreamStatusContext.Provider>
  );
}

export function StreamLiveBadge() {
  const isLive = useContext(StreamStatusContext);
  if (isLive === true) {
    return (
      <p className="inline-flex items-center gap-3 rounded-full border border-emerald-500/30 bg-emerald-950/60 px-5 py-2 text-xl font-black uppercase tracking-wider text-emerald-300 shadow-[0_0_40px_rgba(16,185,129,0.15)] sm:text-3xl">
        <span className="h-3 w-3 animate-pulse rounded-full bg-emerald-400" />
        Právě streamuje
      </p>
    );
  }
  if (isLive === null) {
    return (
      <p className="inline-flex rounded-full border border-zinc-700 bg-zinc-900/70 px-4 py-2 text-sm font-medium text-zinc-300">
        Stav streamu se nepodařilo ověřit
      </p>
    );
  }
  return null;
}

export function StreamSpotifyCard({
  initialPlayback,
  isAdmin,
  spotifyConnected,
}: {
  initialPlayback: SpotifyPlayback | null;
  isAdmin: boolean;
  spotifyConnected: boolean;
}) {
  return (
    <NowPlayingCard
      initialPlayback={initialPlayback}
      isAdmin={isAdmin}
      spotifyConnected={spotifyConnected}
    />
  );
}
