"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WheelSlice, WheelSpinSegment } from "@/lib/wheels";
import type { WheelRealtimeEvent } from "@/lib/wheel-realtime";
import useWheelRealtime from "./useWheelRealtime";

type OverlaySpin = {
  id: string;
  event_id: string;
  display_name: string;
  sequence: WheelSpinSegment[];
};

type WheelDisplay = Pick<WheelSpinSegment, "title" | "slices">;

const WHEEL_CENTER = 300;
const WHEEL_RADIUS = 282;

function getSliceProbability(slice: WheelSlice): number {
  if ("probability" in slice && typeof slice.probability === "number") {
    return slice.probability;
  }
  const legacySlice = slice as WheelSlice & { weight?: unknown };
  return typeof legacySlice.weight === "number" ? legacySlice.weight : 0;
}

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

function isWheelDisplay(value: unknown): value is WheelDisplay {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const wheel = value as Record<string, unknown>;
  return (
    typeof wheel.title === "string" &&
    Array.isArray(wheel.slices) &&
    wheel.slices.length > 0 &&
    wheel.slices.every((slice) => {
      if (typeof slice !== "object" || slice === null || Array.isArray(slice)) {
        return false;
      }
      const item = slice as Record<string, unknown>;
      return (
        typeof item.id === "string" &&
        typeof item.label === "string" &&
        typeof item.color === "string"
      );
    })
  );
}

export default function WheelOverlay() {
  const [queue, setQueue] = useState<OverlaySpin[]>([]);
  const [activeStep, setActiveStep] = useState(0);
  const [rotation, setRotation] = useState(0);
  const [revealedKey, setRevealedKey] = useState("");
  const [idleWheel, setIdleWheel] = useState<WheelDisplay | null>(null);
  const [lastSegment, setLastSegment] = useState<WheelSpinSegment | null>(null);
  const [lastPick, setLastPick] = useState<string | null>(null);
  const [lastPickColor, setLastPickColor] = useState<string | null>(null);
  const [resultPhase, setResultPhase] = useState<"entering" | "leaving" | null>(null);
  const [wheelVisible, setWheelVisible] = useState(true);
  const wheelRef = useRef<SVGGElement | null>(null);
  const rotationRef = useRef(0);
  const hideWheelTimer = useRef<number | null>(null);

  const handleRealtimeEvent = useCallback((event: WheelRealtimeEvent) => {
    if (event.type === "snapshot") {
      if (event.wheel === null) {
        setIdleWheel(null);
      } else if (isWheelDisplay(event.wheel)) {
        setIdleWheel(event.wheel);
      } else {
        console.error("Wheel WebSocket received an invalid wheel configuration.");
      }
      return;
    }
    if (event.type !== "spin") return;
    const spin = event.spin;
    if (!isOverlaySpin(spin)) {
      console.error("Wheel WebSocket received an invalid spin.");
      return;
    }
    if (hideWheelTimer.current !== null) {
      window.clearTimeout(hideWheelTimer.current);
      hideWheelTimer.current = null;
    }
    setWheelVisible(true);
    setLastPick(null);
    setLastPickColor(null);
    setResultPhase(null);
    setQueue((current) =>
      current.some((queuedSpin) => queuedSpin.id === spin.id)
        ? current
        : [...current, spin],
    );
  }, []);
  useWheelRealtime(handleRealtimeEvent);

  const activeSpin = queue[0];
  const segment = activeSpin?.sequence[activeStep];
  const displaySegment: WheelDisplay | null =
    segment ?? lastSegment ?? idleWheel;
  useEffect(() => {
    if (!activeSpin || !segment) return;
    if (hideWheelTimer.current !== null) {
      window.clearTimeout(hideWheelTimer.current);
      hideWheelTimer.current = null;
    }
    const selectedIndex = segment.slices.findIndex(
      (slice) => slice.id === segment.selectedSliceId,
    );
    if (selectedIndex < 0 || segment.slices.length === 0) {
      console.error("Wheel overlay received an invalid selected slice.");
      return;
    }

    const probabilities = segment.slices.map(getSliceProbability);
    const totalProbability = probabilities.reduce((total, value) => total + value, 0);
    if (!Number.isFinite(totalProbability) || totalProbability <= 0) {
      console.error("Wheel overlay received invalid outcome probabilities.");
      return;
    }
    const selectedAngle =
      ((probabilities.slice(0, selectedIndex).reduce((total, value) => total + value, 0) +
        probabilities[selectedIndex] / 2) /
        totalProbability) *
      360;
    const currentAngle = ((rotationRef.current % 360) + 360) % 360;
    const delta = 360 * 3 + ((360 - selectedAngle - currentAngle + 360) % 360);
    const from = rotationRef.current;
    const to = from + delta;
    const wheel = wheelRef.current;
    if (!wheel) return;
    wheel.setAttribute("transform", `rotate(${from} ${WHEEL_CENTER} ${WHEEL_CENTER})`);
    let animationFrame = 0;
    let revealTimer = 0;
    const startedAt = performance.now();
    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / segment.durationMs);
      const eased = 1 - Math.pow(1 - progress, 4);
      wheel.setAttribute(
        "transform",
        `rotate(${from + (to - from) * eased} ${WHEEL_CENTER} ${WHEEL_CENTER})`,
      );
      if (progress < 1) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      rotationRef.current = to;
      setRotation(to);
      revealTimer = window.setTimeout(() => {
        setRevealedKey(`${activeSpin.id}:${activeStep}`);
        if (activeStep + 1 < activeSpin.sequence.length) {
          setActiveStep(activeStep + 1);
        } else {
          setLastSegment(segment);
          setLastPick(segment.selectedLabel);
          setLastPickColor(
            segment.slices.find((slice) => slice.id === segment.selectedSliceId)?.color ?? null,
          );
          setResultPhase("entering");
          setActiveStep(0);
          setQueue((current) => current.slice(1));
          hideWheelTimer.current = window.setTimeout(() => {
            setResultPhase("leaving");
            hideWheelTimer.current = window.setTimeout(() => {
              setWheelVisible(false);
              setResultPhase(null);
              setLastPick(null);
              setLastPickColor(null);
              hideWheelTimer.current = null;
            }, 700);
          }, 2_000);
        }
      }, 500);
    };
    animationFrame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.clearTimeout(revealTimer);
    };
  }, [activeSpin, activeStep, segment]);

  useEffect(
    () => () => {
      if (hideWheelTimer.current !== null) {
        window.clearTimeout(hideWheelTimer.current);
      }
    },
    [],
  );

  return (
    <main className="wheel-overlay-canvas pointer-events-none fixed inset-0 flex items-end justify-center overflow-hidden p-5 text-white sm:p-8">
      {wheelVisible && displaySegment && (
        <div
          className={`wheel-overlay-enter relative mb-2 w-[min(92vw,76vh,40rem)] ${
            resultPhase === "leaving" ? "wheel-overlay-exit" : ""
          }`}
        >
          <div
            className={
              resultPhase ? "wheel-overlay-result-backdrop" : ""
            }
          >
            <div className="absolute left-1/2 top-0 z-10 h-0 w-0 -translate-x-1/2 border-x-[18px] border-t-[32px] border-x-transparent border-t-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]" />
            <svg
              viewBox="0 0 600 600"
              role="img"
              aria-label={`Wheel ${displaySegment.title}`}
              className="block h-auto w-full overflow-visible"
            >
              <g
                ref={wheelRef}
                transform={`rotate(${rotation} ${WHEEL_CENTER} ${WHEEL_CENTER})`}
              >
                <circle
                  cx={WHEEL_CENTER}
                  cy={WHEEL_CENTER}
                  r={WHEEL_RADIUS + 9}
                  fill="#09090b"
                  stroke="#f4f4f5"
                  strokeWidth="8"
                />
                {displaySegment.slices.map((slice: WheelSlice, index: number) => {
                  const totalProbability = displaySegment.slices.reduce(
                    (total, item) => total + getSliceProbability(item),
                    0,
                  );
                  const precedingProbability = displaySegment.slices
                    .slice(0, index)
                    .reduce((total, item) => total + getSliceProbability(item), 0);
                  const sectorSize =
                    (getSliceProbability(slice) / totalProbability) * 360;
                  const startAngle = (precedingProbability / totalProbability) * 360;
                  const middleAngle = startAngle + sectorSize / 2;
                  const start = polarPoint(startAngle, WHEEL_RADIUS);
                  const end = polarPoint(startAngle + sectorSize, WHEEL_RADIUS);
                  const fontSize = Math.max(
                    10,
                    Math.min(30, 780 / displaySegment.slices.length, sectorSize * 1.25),
                  );
                  const textStart = 52;
                  const textMaxWidth = WHEEL_RADIUS - textStart - 18;
                  const maxCharacters = Math.floor(textMaxWidth / (fontSize * 0.6));
                  const visibleLabel =
                    sectorSize < 6
                      ? ""
                      : slice.label.length > maxCharacters
                        ? `${slice.label.slice(0, maxCharacters - 1)}…`
                        : slice.label;
                  const labelWidth = Math.min(
                    textMaxWidth,
                    Math.max(fontSize, visibleLabel.length * fontSize * 0.6),
                  );
                  return (
                    <g key={slice.id}>
                      <path
                        d={`M ${WHEEL_CENTER} ${WHEEL_CENTER} L ${start.x} ${start.y} A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 ${sectorSize > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`}
                        fill={slice.color}
                        stroke="#ffffff"
                        strokeOpacity="0.7"
                        strokeWidth={
                          (activeSpin !== undefined &&
                            revealedKey === `${activeSpin.id}:${activeStep}` &&
                            slice.id === segment?.selectedSliceId) ||
                          (!activeSpin &&
                            lastPick !== null &&
                            slice.id === lastSegment?.selectedSliceId)
                            ? "7"
                            : "2"
                        }
                      />
                      <text
                        x={WHEEL_CENTER + textStart}
                        y={WHEEL_CENTER}
                        textAnchor="start"
                        dominantBaseline="middle"
                        transform={`rotate(${middleAngle - 90} ${WHEEL_CENTER} ${WHEEL_CENTER})`}
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
                        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
                      >
                        {visibleLabel}
                      </text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
          {lastPick && !segment && resultPhase && (
            <div className="absolute inset-0 z-20 flex items-center justify-center">
              <p
                key={lastPick}
                aria-live="polite"
                className="wheel-result-enter max-w-[85%] break-words rounded-2xl border-2 border-white/90 bg-zinc-950/95 px-7 py-5 text-center text-2xl font-black leading-tight text-white sm:px-10 sm:py-7 sm:text-4xl"
              >
                <span className="flex items-center justify-center gap-3">
                  {lastPickColor && (
                    <span
                      aria-label={`Prize color ${lastPickColor}`}
                      className="h-5 w-5 shrink-0 rounded-full border-2 border-white"
                      style={{ backgroundColor: lastPickColor }}
                    />
                  )}
                  {lastPick}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
