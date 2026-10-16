"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { WheelSpinSegment } from "@/lib/wheels";

type OverlaySpin = {
  id: string;
  event_id: string;
  display_name: string;
  sequence: WheelSpinSegment[];
};

type WheelAnimation = {
  key: string;
  from: number;
  to: number;
  durationMs: number;
};

const WHEEL_CENTER = 300;
const WHEEL_RADIUS = 282;

function polarPoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return {
    x: WHEEL_CENTER + Math.sin(radians) * radius,
    y: WHEEL_CENTER - Math.cos(radians) * radius,
  };
}

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
  const [animation, setAnimation] = useState<WheelAnimation | null>(null);
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
    const from = rotationRef.current;
    const to = from + delta;
    setAnimation({
      key: `${activeSpin.id}:${activeStep}`,
      from,
      to,
      durationMs: segment.durationMs,
    });

    const timer = window.setTimeout(() => {
      rotationRef.current = to;
      setRotation(to);
      setAnimation(null);
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

  return (
    <main className="wheel-overlay-canvas pointer-events-none fixed inset-0 flex items-end justify-center overflow-hidden p-5 text-white sm:p-8">
      {activeSpin && segment && (
        <div className="wheel-overlay-enter relative mb-2 w-[min(92vw,76vh,40rem)]">
          <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[18px] border-t-[32px] border-x-transparent border-t-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" />
          <svg
            viewBox="0 0 600 600"
            role="img"
            aria-label={`Koleso ${segment.title}`}
            className="block h-auto w-full overflow-visible"
          >
            <g
              className={animation ? "wheel-spin-animation" : undefined}
              key={animation?.key ?? "idle"}
              style={
                animation
                  ? ({
                      "--wheel-start": `${animation.from}deg`,
                      "--wheel-end": `${animation.to}deg`,
                      animationDuration: `${animation.durationMs}ms`,
                    } as CSSProperties)
                  : {
                      transform: `rotate(${rotation}deg)`,
                      transformBox: "view-box",
                      transformOrigin: "center",
                    }
              }
            >
              <circle
                cx={WHEEL_CENTER}
                cy={WHEEL_CENTER}
                r={WHEEL_RADIUS + 9}
                fill="#09090b"
                stroke="#f4f4f5"
                strokeWidth="8"
              />
              {segment.slices.map((slice, index) => {
                const sectorSize = 360 / segment.slices.length;
                const start = polarPoint(index * sectorSize, WHEEL_RADIUS);
                const end = polarPoint((index + 1) * sectorSize, WHEEL_RADIUS);
                const middleAngle = (index + 0.5) * sectorSize;
                const labelPosition = polarPoint(middleAngle, WHEEL_RADIUS * 0.69);
                const arcWidth =
                  (2 * Math.PI * WHEEL_RADIUS * 0.69) / segment.slices.length;
                const fontSize = Math.max(16, Math.min(32, arcWidth * 0.55));
                const visibleLabel =
                  slice.label.length > 24 ? `${slice.label.slice(0, 23)}…` : slice.label;
                const labelWidth = Math.min(
                  200,
                  Math.max(50, visibleLabel.length * fontSize * 0.6),
                );
                return (
                  <g key={slice.id}>
                    <path
                      d={`M ${WHEEL_CENTER} ${WHEEL_CENTER} L ${start.x} ${start.y} A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 ${end.x} ${end.y} Z`}
                      fill={slice.color}
                      stroke="#ffffff"
                      strokeOpacity="0.7"
                      strokeWidth="2"
                    />
                    <text
                      x={labelPosition.x}
                      y={labelPosition.y}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${middleAngle - 90} ${labelPosition.x} ${labelPosition.y})`}
                      fill="#ffffff"
                      stroke="#09090b"
                      strokeWidth="3"
                      strokeLinejoin="round"
                      paintOrder="stroke"
                      fontSize={fontSize}
                      fontWeight="900"
                      letterSpacing="0.3"
                      textLength={labelWidth}
                      lengthAdjust="spacingAndGlyphs"
                    >
                      {visibleLabel}
                    </text>
                  </g>
                );
              })}
              <circle
                cx={WHEEL_CENTER}
                cy={WHEEL_CENTER}
                r="65"
                fill="#09090b"
                stroke="#ffffff"
                strokeWidth="7"
              />
              <text
                x={WHEEL_CENTER}
                y={WHEEL_CENTER + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#ffffff"
                fontSize="25"
                fontWeight="900"
                letterSpacing="2"
              >
                {revealedKey === `${activeSpin.id}:${activeStep}`
                  ? segment.selectedLabel
                  : "N4JT"}
              </text>
            </g>
          </svg>
        </div>
      )}
    </main>
  );
}
