"use client";

import { useEffect, useRef, useState } from "react";
import type { WheelSpinSegment } from "@/lib/wheels";

type OverlaySpin = {
  id: string;
  event_id: string;
  display_name: string;
  sequence: WheelSpinSegment[];
};

function isOverlaySpin(value: unknown): value is OverlaySpin {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const spin = value as Record<string, unknown>;
  return (
    typeof spin.id === "string" &&
    typeof spin.event_id === "string" &&
    typeof spin.display_name === "string" &&
    Array.isArray(spin.sequence) &&
    spin.sequence.every((segment) => {
      if (typeof segment !== "object" || segment === null || Array.isArray(segment)) {
        return false;
      }
      const item = segment as Record<string, unknown>;
      return (
        typeof item.title === "string" &&
        typeof item.durationMs === "number" &&
        Array.isArray(item.slices) &&
        item.slices.length > 0 &&
        typeof item.selectedSliceId === "string" &&
        typeof item.selectedLabel === "string" &&
        item.slices.some(
          (slice) =>
            typeof slice === "object" &&
            slice !== null &&
            !Array.isArray(slice) &&
            "id" in slice &&
            slice.id === item.selectedSliceId,
        )
      );
    })
  );
}

export default function WheelOverlay() {
  const [queue, setQueue] = useState<OverlaySpin[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [revealedKey, setRevealedKey] = useState("");
  const cursor = useRef<string | null>(null);
  const rotationRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    let loading = false;
    const poll = async () => {
      if (loading) return;
      loading = true;
      try {
        const url = cursor.current
          ? `/api/overlays/wheels/spins?cursor=${encodeURIComponent(cursor.current)}`
          : "/api/overlays/wheels/spins";
        const response = await fetch(url, { cache: "no-store" });
        const result: {
          spins?: OverlaySpin[];
          cursor?: string;
          error?: string;
        } = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Overlay kolesa sa nepodarilo načítať.");
        if (!mounted) return;
        cursor.current = result.cursor ?? cursor.current;
        if (result.spins?.length) {
          const validSpins = result.spins.filter(isOverlaySpin);
          if (validSpins.length !== result.spins.length) {
            throw new Error("Koleso vrátilo neplatné údaje spinov.");
          }
          setQueue((current) => [...current, ...validSpins]);
        }
      } catch (error) {
        console.error("Wheel overlay polling failed:", error);
      } finally {
        loading = false;
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), 1_000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const activeSpin = queue[0];
  const segment = activeSpin?.sequence[activeStep];
  useEffect(() => {
    if (!activeSpin || !segment) return;
    const selectedIndex = segment.slices.findIndex(
      (slice) => slice.id === segment.selectedSliceId,
    );
    if (selectedIndex < 0 || segment.slices.length === 0) {
      console.error("Wheel overlay received an invalid selected slice.");
      return;
    }

    const sectorSize = 360 / segment.slices.length;
    const selectedAngle = (selectedIndex + 0.5) * sectorSize;
    const currentAngle = ((rotationRef.current % 360) + 360) % 360;
    const delta = 360 * 3 + ((360 - selectedAngle - currentAngle + 360) % 360);
    rotationRef.current += delta;
    setRotation(rotationRef.current);

    const timer = window.setTimeout(() => {
      setRevealedKey(`${activeSpin.id}:${activeStep}`);
      if (activeStep + 1 < activeSpin.sequence.length) {
        setActiveStep(activeStep + 1);
      } else {
        setActiveStep(0);
        setQueue((current) => current.slice(1));
      }
    }, segment.durationMs + 500);
    return () => window.clearTimeout(timer);
  }, [activeSpin, activeStep, segment]);

  const background = segment
    ? `conic-gradient(${segment.slices
        .map((slice, index) => {
          const start = (index / segment.slices.length) * 360;
          const end = ((index + 1) / segment.slices.length) * 360;
          return `${slice.color} ${start}deg ${end}deg`;
        })
        .join(", ")})`
    : "conic-gradient(#7c3aed 0deg 90deg, #312e81 90deg 180deg, #db2777 180deg 270deg, #4338ca 270deg 360deg)";

  return (
    <main className="wheel-overlay-canvas pointer-events-none fixed inset-0 flex items-end justify-center overflow-hidden p-6 text-white sm:p-10">
      {activeSpin && segment && (
        <div className="wheel-overlay-enter relative mb-2 h-[min(80vw,28rem)] w-[min(80vw,28rem)]">
          <div className="absolute -top-1 left-1/2 z-10 h-0 w-0 -translate-x-1/2 border-x-[14px] border-t-[25px] border-x-transparent border-t-white drop-shadow-lg" />
          <div
            role="group"
            aria-label={`Koleso ${segment.title}`}
            className="relative h-full w-full rounded-full border-[8px] border-zinc-100 shadow-[0_0_35px_rgba(139,92,246,0.6)]"
            style={{
              background,
              transform: `rotate(${rotation}deg)`,
              transition: `transform ${segment.durationMs}ms cubic-bezier(0.08, 0.62, 0.12, 1)`,
            }}
          >
            {segment.slices.map((slice, index) => {
              const angle = (index + 0.5) * (360 / segment.slices.length);
              const width = Math.max(52, Math.min(128, (360 / segment.slices.length) * 1.8));
              return (
                <span
                  key={slice.id}
                  className="absolute left-1/2 top-1/2 truncate text-center text-xs font-black leading-tight text-white drop-shadow-[0_1px_3px_rgba(0,0,0,1)] sm:text-sm"
                  style={{
                    width: `${width}px`,
                    transform: `rotate(${angle}deg) translateY(clamp(-10rem, -29vw, -4rem)) rotate(90deg)`,
                  }}
                  title={slice.label}
                >
                  {slice.label}
                </span>
              );
            })}
            <div className="absolute left-1/2 top-1/2 flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-4 border-white/70 bg-zinc-950 px-2 text-center text-xs font-black shadow-xl sm:h-24 sm:w-24">
              {revealedKey === `${activeSpin.id}:${activeStep}`
                ? segment.selectedLabel
                : "N4JT"}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
