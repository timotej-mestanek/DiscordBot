"use client";

import { useRef, useState } from "react";

const topLeds = Array.from({ length: 100 }, (_, index) => ({
  x: 48 + (1_196 - 48) * (index / 99),
  y: 48,
}));

const rightLeds = Array.from({ length: 72 }, (_, index) => ({
  x: 1_210,
  y: 58 + (618 - 58) * (index / 71),
}));

const bottomLeds = Array.from({ length: 39 }, (_, index) => ({
  x: 263 + (1_172 - 263) * (index / 38),
  y: 608,
}));

const upperLeftLeds = Array.from({ length: 8 }, (_, index) => ({
  x: 52 + (223 - 52) * (index / 7),
  y: 147,
}));

const leftLeds = Array.from({ length: 30 }, (_, index) => ({
  x: 234,
  y: 158 + (607 - 158) * (index / 29),
}));

const hexagons = [
  { x: 630, y: 339 },
  { x: 657, y: 321 },
  { x: 687, y: 308 },
  { x: 715, y: 322 },
  { x: 739, y: 305 },
  { x: 741, y: 336 },
  { x: 715, y: 351 },
  { x: 770, y: 322 },
  { x: 771, y: 352 },
  { x: 794, y: 305 },
  { x: 822, y: 322 },
  { x: 849, y: 338 },
];

export const LED_COUNT = 333;
const allLedPositions = [
  ...topLeds,
  ...rightLeds,
  ...bottomLeds,
  ...[...leftLeds].reverse(),
  ...[...upperLeftLeds].reverse(),
  ...hexagons.flatMap(({ x, y }) => {
    const radius = 15.5;
    const bulbs = Array.from({ length: 6 }, (_, index) => {
      const angle = ((index * 60 - 30) * Math.PI) / 180;
      return {
        x: x + radius * 0.67 * Math.cos(angle),
        y: y + radius * 0.67 * Math.sin(angle),
      };
    });
    return [...bulbs, { x, y }];
  }),
];

function LedBulbs({
  leds,
  color,
  radius,
  opacity,
  colors,
  firstId,
  selectedLedIds,
}: {
  leds: { x: number; y: number }[];
  color: string;
  radius: number;
  opacity?: number[];
  colors?: string[];
  firstId: number;
  selectedLedIds?: number[];
}) {
  return (
    <g>
      {leds.map((led, index) => (
        <g key={index}>
          <circle cx={led.x} cy={led.y} r={radius + 3} fill={colors?.[index] ?? color} opacity={(opacity?.[index] ?? 1) * 0.16} pointerEvents="none" />
          <circle
            cx={led.x}
            cy={led.y}
            r={radius}
            fill={colors?.[index] ?? color}
            opacity={opacity?.[index] ?? 1}
            stroke={selectedLedIds?.includes(firstId + index) ? "#fff" : "none"}
            strokeWidth="2"
            data-led-id={firstId + index}
          />
          <circle
            cx={led.x}
            cy={led.y}
            r={radius * 0.38}
            fill="#fff7d6"
            opacity={(opacity?.[index] ?? 1) * 0.9}
            pointerEvents="none"
          />
        </g>
      ))}
    </g>
  );
}

function HexagonLeds({
  colors,
  opacity,
  selectedLedIds,
  firstId,
  isCustom,
}: {
  colors: string[];
  opacity?: number[];
  selectedLedIds?: number[];
  firstId: number;
  isCustom: boolean;
}) {
  return (
    <g>
      {hexagons.map(({ x, y }, hexagonIndex) => {
        const radius = 15.5;
        const points = Array.from({ length: 6 }, (_, index) => {
          const angle = ((index * 60 - 30) * Math.PI) / 180;
          return `${x + radius * Math.cos(angle)},${y + radius * Math.sin(angle)}`;
        }).join(" ");
        const bulbs = Array.from({ length: 6 }, (_, index) => {
          const angle = ((index * 60 - 30) * Math.PI) / 180;
          return {
            x: x + radius * 0.67 * Math.cos(angle),
            y: y + radius * 0.67 * Math.sin(angle),
          };
        });

        const positions = [...bulbs, { x, y }];
        const hexagonFirstId = firstId + hexagonIndex * 7;
        return (
          <g key={hexagonIndex}>
            <polygon points={points} fill={isCustom ? "#18181b" : "#43d000"} pointerEvents="none" />
            {positions.map((position, index) => (
              <g key={index}>
                <circle
                  cx={position.x}
                  cy={position.y}
                  r="2.5"
                  fill={colors[hexagonFirstId + index] ?? "#ff4d6d"}
                  opacity={opacity?.[hexagonFirstId + index] ?? 1}
                  stroke={selectedLedIds?.includes(hexagonFirstId + index) ? "#fff" : "none"}
                  strokeWidth="1.5"
                  data-led-id={hexagonFirstId + index}
                />
              </g>
            ))}
          </g>
        );
      })}
    </g>
  );
}

export function CustomLedLayout({
  color,
  className,
  colors,
  opacity,
  selectedLedIds,
  onLedSelectionChange,
}: {
  color?: string;
  className?: string;
  colors?: string[];
  opacity?: number[];
  selectedLedIds?: number[];
  onLedSelectionChange?: (ids: number[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const selectionAnchor = useRef<number | null>(null);
  const dragStart = useRef<{ x: number; y: number; initialIds: number[]; shift: boolean; ctrl: boolean } | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const palette = colors ?? Array.from({ length: LED_COUNT }, (_, index) =>
    index >= 249 ? "#ff4d6d" : color ?? (index < 172 ? "#16a34a" : "#eab308"),
  );

  function toViewBoxPoint(event: React.PointerEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return null;
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(matrix.inverse());
  }

  function handlePointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (!onLedSelectionChange) return;
    event.preventDefault();
    const point = toViewBoxPoint(event);
    if (!point) return;
    const ledId = allLedPositions.reduce<number | null>((nearest, position, id) => {
      const distance = Math.hypot(position.x - point.x, position.y - point.y);
      if (distance > 8) return nearest;
      if (nearest === null) return id;
      const nearestDistance = Math.hypot(
        allLedPositions[nearest].x - point.x,
        allLedPositions[nearest].y - point.y,
      );
      return distance < nearestDistance ? id : nearest;
    }, null);
    const current = selectedLedIds ?? [];
    if (ledId !== null && event.shiftKey && current.length) {
      const anchor = selectionAnchor.current ?? current[0];
      const start = Math.min(anchor, ledId);
      const end = Math.max(anchor, ledId);
      onLedSelectionChange(Array.from({ length: end - start + 1 }, (_, index) => start + index));
      return;
    }
    if (ledId !== null && (event.ctrlKey || event.metaKey)) {
      selectionAnchor.current = ledId;
      onLedSelectionChange(
        current.includes(ledId)
          ? current.filter((id) => id !== ledId)
          : [...current, ledId].sort((a, b) => a - b),
      );
      return;
    }
    if (
      ledId !== null &&
      !event.shiftKey &&
      (current.length !== 1 || current[0] !== ledId)
    ) {
      selectionAnchor.current = ledId;
      onLedSelectionChange([ledId]);
    } else if (ledId === null && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
      onLedSelectionChange([]);
    }
    if (ledId !== null && current.length === 1 && current[0] === ledId) {
      dragStart.current = {
        x: point.x,
        y: point.y,
        initialIds: [...current],
        shift: event.shiftKey,
        ctrl: event.ctrlKey || event.metaKey,
      };
    } else {
      const initialIds = event.ctrlKey || event.metaKey || event.shiftKey ? current : [];
      dragStart.current = {
        x: point.x,
        y: point.y,
        initialIds: [...initialIds],
        shift: event.shiftKey,
        ctrl: event.ctrlKey || event.metaKey,
      };
      if (ledId !== null && !event.shiftKey && !event.ctrlKey && !event.metaKey) {
        dragStart.current.initialIds = [ledId];
      }
    }
    svgRef.current?.setPointerCapture(event.pointerId);
    setSelectionBox({ x: point.x, y: point.y, width: 0, height: 0 });
  }

  function handlePointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (!dragStart.current || !onLedSelectionChange) return;
    const point = toViewBoxPoint(event);
    if (!point) return;
    const start = dragStart.current;
    const box = {
      x: Math.min(start.x, point.x),
      y: Math.min(start.y, point.y),
      width: Math.abs(point.x - start.x),
      height: Math.abs(point.y - start.y),
    };
    setSelectionBox(box);
    if (box.width < 2 && box.height < 2) return;
    const contained = allLedPositions.flatMap((position, index) =>
      position.x >= box.x &&
      position.x <= box.x + box.width &&
      position.y >= box.y &&
      position.y <= box.y + box.height
        ? [index]
        : [],
    );
    const next = new Set(start.initialIds);
    if (start.ctrl) {
      contained.forEach((id) => next.has(id) ? next.delete(id) : next.add(id));
    } else {
      contained.forEach((id) => next.add(id));
    }
    onLedSelectionChange([...next].sort((a, b) => a - b));
  }

  function handlePointerUp() {
    dragStart.current = null;
    setSelectionBox(null);
  }

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 1280 720"
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label="LED layout: top strip, upper-left and left vertical strips, right and bottom strips, and 12 hexagons with 7 LEDs each"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={onLedSelectionChange ? { cursor: "crosshair", touchAction: "none" } : undefined}
    >
      <LedBulbs leds={topLeds} color={color ?? "#16a34a"} colors={colors?.slice(0, 100)} radius={3.6} firstId={0} selectedLedIds={selectedLedIds} opacity={opacity?.slice(0, 100)} />
      <LedBulbs leds={rightLeds} color={color ?? "#16a34a"} colors={colors?.slice(100, 172)} radius={3.3} firstId={100} selectedLedIds={selectedLedIds} opacity={opacity?.slice(100, 172)} />
      <LedBulbs leds={bottomLeds} color={color ?? "#eab308"} colors={colors?.slice(172, 211)} radius={4.2} firstId={172} selectedLedIds={selectedLedIds} opacity={opacity?.slice(172, 211)} />
      <LedBulbs leds={[...leftLeds].reverse()} color={color ?? "#eab308"} colors={colors?.slice(211, 241)} radius={4.2} firstId={211} selectedLedIds={selectedLedIds} opacity={opacity?.slice(211, 241)} />
      <LedBulbs leds={[...upperLeftLeds].reverse()} color={color ?? "#eab308"} colors={colors?.slice(241, 249)} radius={4.2} firstId={241} selectedLedIds={selectedLedIds} opacity={opacity?.slice(241, 249)} />

      <HexagonLeds
        colors={palette}
        opacity={opacity}
        selectedLedIds={selectedLedIds}
        firstId={249}
        isCustom={Boolean(colors || color)}
      />
      {selectionBox && (
        <rect
          x={selectionBox.x}
          y={selectionBox.y}
          width={selectionBox.width}
          height={selectionBox.height}
          fill="#7c3aed"
          fillOpacity="0.14"
          stroke="#a78bfa"
          strokeDasharray="5 4"
          pointerEvents="none"
        />
      )}
    </svg>
  );
}

export default function CustomLedEffectOverlay() {
  return (
    <main className="overlay-canvas fixed inset-0 pointer-events-none">
      <CustomLedLayout className="h-full w-full" />
    </main>
  );
}
