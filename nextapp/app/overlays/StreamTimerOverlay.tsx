"use client";

import { useCallback, useEffect, useState } from "react";
import type {
  StreamOverlayMessage,
  StreamOverlaySnapshot,
  StreamTimerEvent,
} from "@/lib/stream-overlay-realtime";
import useStreamOverlayRealtime from "./useStreamOverlayRealtime";

function isSnapshot(event: StreamOverlayMessage): event is StreamOverlaySnapshot {
  return event.type === "snapshot";
}

export default function StreamTimerOverlay() {
  const [timer, setTimer] = useState<StreamTimerEvent | null>(null);
  const [now, setNow] = useState<number | null>(null);

  const handleRealtimeEvent = useCallback(
    (event: StreamOverlayMessage) => {
      if (isSnapshot(event)) {
        setTimer(event.timer);
        if (event.timer) setNow(Date.now());
      } else if (event.type === "timer") {
        setTimer(event);
        setNow(Date.now());
      }
    },
    [],
  );
  useStreamOverlayRealtime(handleRealtimeEvent);

  useEffect(() => {
    if (!timer) return;
    const interval = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(interval);
  }, [timer]);

  const remainingSeconds =
    timer && now !== null
      ? Math.max(
          0,
          Math.ceil(
            (Date.parse(timer.startedAt) + timer.durationSeconds * 1_000 - now) /
              1_000,
          ),
        )
      : 0;
  if (!timer || remainingSeconds <= 0) return null;

  const hours = Math.floor(remainingSeconds / 3_600);
  const minutes = Math.floor((remainingSeconds % 3_600) / 60);
  const seconds = remainingSeconds % 60;
  const time = hours > 0
    ? `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  return (
    <main className="timer-overlay-canvas fixed inset-0 grid place-items-center overflow-hidden p-6">
      <section
        key={timer.eventId}
        className="timer-panel relative flex w-[min(38rem,calc(100vw-2rem))] flex-col items-center overflow-hidden rounded-[2rem] border border-cyan-200/30 bg-slate-950/80 px-8 py-10 text-center text-white shadow-[0_0_90px_rgba(34,211,238,0.24)] backdrop-blur-xl sm:px-14 sm:py-12"
        aria-live="polite"
      >
        <div className="timer-orbit timer-orbit-one" />
        <div className="timer-orbit timer-orbit-two" />
        <div className="timer-scanline" />
        <p className="relative z-10 text-xs font-black uppercase tracking-[0.42em] text-cyan-200">
          {timer.title}
        </p>
        <div className="timer-count-glow relative z-10 mt-4 font-mono text-[clamp(4.5rem,18vw,9rem)] font-black leading-none tracking-[-0.08em] tabular-nums">
          <span key={remainingSeconds} className="timer-digit inline-block">
            {time}
          </span>
        </div>
        <div className="relative z-10 mt-6 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.32em] text-cyan-100/70">
          <span className="timer-live-dot h-2 w-2 rounded-full bg-cyan-300" />
          Countdown active
        </div>
      </section>
    </main>
  );
}
