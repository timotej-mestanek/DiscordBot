"use client";

import { useCallback, useState } from "react";
import type {
  StreamOverlayMessage,
  StreamOverlaySnapshot,
  StreamVotingEvent,
} from "@/lib/stream-overlay-realtime";
import useStreamOverlayRealtime from "./useStreamOverlayRealtime";

function isSnapshot(event: StreamOverlayMessage): event is StreamOverlaySnapshot {
  return event.type === "snapshot";
}

export default function StreamVotingOverlay() {
  const [voting, setVoting] = useState<StreamVotingEvent | null>(null);

  const handleRealtimeEvent = useCallback((event: StreamOverlayMessage) => {
    if (isSnapshot(event)) {
      setVoting(event.voting?.active ? event.voting : null);
    } else if (event.type === "voting") {
      setVoting(event.active ? event : null);
    }
  }, []);
  useStreamOverlayRealtime(handleRealtimeEvent);

  if (!voting) return null;

  const totalVotes = voting.options.reduce((total, option) => total + option.votes, 0);
  const maxVotes = Math.max(1, ...voting.options.map((option) => option.votes));

  return (
    <main className="voting-overlay-canvas fixed inset-0 flex items-center justify-end overflow-hidden p-6 sm:p-10">
      <section
        key={voting.eventId}
        className="voting-panel w-[min(34rem,calc(100vw-3rem))] rounded-[1.75rem] border border-fuchsia-200/25 bg-[#100b1b]/90 p-6 text-white shadow-[0_24px_100px_rgba(168,85,247,0.2)] backdrop-blur-2xl sm:p-8"
        aria-live="polite"
      >
        <div className="flex items-center gap-3">
          <span className="voting-live-indicator relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-70" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-fuchsia-300" />
          </span>
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-200">
            Live vote · {totalVotes.toLocaleString()}
          </p>
        </div>
        <h1 className="mt-4 text-2xl font-black leading-tight tracking-tight sm:text-3xl">
          {voting.question}
        </h1>
        <div className="mt-7 space-y-4">
          {voting.options.map((option, index) => {
            const percentage =
              totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100);
            const width = Math.round((option.votes / maxVotes) * 100);
            return (
              <article key={option.id} className="voting-option">
                <div className="mb-2 flex items-end justify-between gap-3">
                  <p className="min-w-0 truncate text-sm font-bold sm:text-base">
                    <span className="mr-2 font-mono text-xs text-fuchsia-300/70">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {option.label}
                  </p>
                  <p className="shrink-0 font-mono text-xs font-bold tabular-nums text-zinc-300">
                    {option.votes.toLocaleString()} · {percentage}%
                  </p>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="voting-bar h-full rounded-full"
                    style={{ width: `${width}%`, animationDelay: `${index * 90}ms` }}
                  />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}
