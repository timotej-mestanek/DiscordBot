"use client";

import { useCallback, useState } from "react";
import type {
  StreamAlertEvent,
  StreamOverlayMessage,
  StreamOverlaySnapshot,
} from "@/lib/stream-overlay-realtime";
import useStreamOverlayRealtime from "./useStreamOverlayRealtime";

function isSnapshot(event: StreamOverlayMessage): event is StreamOverlaySnapshot {
  return event.type === "snapshot";
}

const severityStyles = {
  info: {
    label: "INFO",
    symbol: "i",
    panel: "border-sky-300/40 bg-sky-950/90 shadow-[0_24px_100px_rgba(14,165,233,0.28)]",
    badge: "bg-sky-300/15 text-sky-100",
    accent: "bg-sky-300 shadow-[0_0_24px_rgba(125,211,252,0.9)]",
  },
  attention: {
    label: "ATTENTION",
    symbol: "!",
    panel: "border-amber-300/40 bg-amber-950/90 shadow-[0_24px_100px_rgba(245,158,11,0.28)]",
    badge: "bg-amber-300/15 text-amber-100",
    accent: "bg-amber-300 shadow-[0_0_24px_rgba(252,211,77,0.9)]",
  },
  warning: {
    label: "WARNING",
    symbol: "!",
    panel: "border-orange-300/40 bg-orange-950/90 shadow-[0_24px_100px_rgba(249,115,22,0.3)]",
    badge: "bg-orange-300/15 text-orange-100",
    accent: "bg-orange-300 shadow-[0_0_24px_rgba(253,186,116,0.9)]",
  },
  critical: {
    label: "CRITICAL",
    symbol: "×",
    panel: "border-red-300/45 bg-red-950/92 shadow-[0_24px_100px_rgba(239,68,68,0.32)]",
    badge: "bg-red-300/15 text-red-100",
    accent: "bg-red-300 shadow-[0_0_24px_rgba(252,165,165,0.95)]",
  },
} satisfies Record<
  StreamAlertEvent["severity"],
  { label: string; symbol: string; panel: string; badge: string; accent: string }
>;

export default function StreamAlertOverlay() {
  const [alert, setAlert] = useState<StreamAlertEvent | null>(null);

  const handleRealtimeEvent = useCallback((event: StreamOverlayMessage) => {
    if (isSnapshot(event)) {
      setAlert(event.alert);
    } else if (event.type === "alert") {
      setAlert(event.active ? event : null);
    }
  }, []);
  useStreamOverlayRealtime(handleRealtimeEvent);

  if (!alert) return null;
  const style = severityStyles[alert.severity];

  return (
    <main className="alert-overlay-canvas fixed inset-0 flex items-start justify-center overflow-hidden p-6 pt-[8vh] sm:p-10 sm:pt-[10vh]">
      <section
        key={alert.eventId}
        className={`alert-panel relative w-[min(58rem,calc(100vw-2rem))] overflow-hidden rounded-[1.75rem] border p-6 text-white backdrop-blur-2xl sm:p-9 ${style.panel}`}
        aria-live="assertive"
        role="alert"
      >
        <div className={`alert-accent absolute inset-x-0 top-0 h-1 ${style.accent}`} />
        <div className="flex items-start gap-5 sm:gap-7">
          <div className={`alert-symbol flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-3xl font-black sm:h-[4.5rem] sm:w-[4.5rem] ${style.badge}`}>
            {style.symbol}
          </div>
          <div className="min-w-0 flex-1">
            <p className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black tracking-[0.28em] ${style.badge}`}>
              {style.label}
            </p>
            <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight sm:text-4xl">
              {alert.title}
            </h1>
            <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-white/85 sm:text-xl">
              {alert.message}
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
