"use client";

import { useMemo, useRef, useState } from "react";

type Animation = "steady" | "linear" | "pulse";
type Keyframe = {
  id: number;
  time: number;
  color: string;
  animation: Animation;
};

const initialFrames: Keyframe[] = [
  { id: 1, time: 0, color: "#8b5cf6", animation: "linear" },
  { id: 2, time: 30, color: "#22d3ee", animation: "pulse" },
  { id: 3, time: 72, color: "#f472b6", animation: "linear" },
  { id: 4, time: 119, color: "#8b5cf6", animation: "steady" },
];

const LAST_FRAME = 119;
const FRAME_COUNT = 120;
const timeLabels = [0, 30, 60, 90, 120];

function formatFrameTime(frame: number) {
  const seconds = frame / 60;
  return `00:${seconds.toFixed(3).padStart(6, "0")}`;
}

function isAnimation(value: string): value is Animation {
  return value === "steady" || value === "linear" || value === "pulse";
}

export default function LEDTimelineEditor({ initialUses }: { initialUses: number }) {
  const [uses, setUses] = useState(initialUses);
  const [frames, setFrames] = useState(initialFrames);
  const [selectedId, setSelectedId] = useState(initialFrames[0].id);
  const [playhead, setPlayhead] = useState(0);
  const [name, setName] = useState("Můj LED efekt");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const draggingFrameId = useRef<number | null>(null);
  const selectedFrame = frames.find((frame) => frame.id === selectedId) ?? frames[0];
  const sortedFrames = useMemo(
    () => [...frames].sort((left, right) => left.time - right.time),
    [frames],
  );

  function updateFrame(changes: Partial<Omit<Keyframe, "id">>) {
    if (!selectedFrame) return;
    setFrames((current) =>
      current.map((frame) =>
        frame.id === selectedFrame.id ? { ...frame, ...changes } : frame,
      ),
    );
  }

  function addKeyframe() {
    if (frames.length >= FRAME_COUNT) {
      setMessage("Efekt už obsahuje všech 120 dostupných snímků.");
      return;
    }
    if (frames.some((frame) => frame.time === playhead)) {
      const frame = frames.find((item) => item.time === playhead);
      if (frame) setSelectedId(frame.id);
      setMessage("Na této pozici už keyframe existuje.");
      return;
    }
    const id = Math.max(...frames.map((frame) => frame.id), 0) + 1;
    const frame = {
      id,
      time: playhead,
      color: selectedFrame?.color ?? "#8b5cf6",
      animation: selectedFrame?.animation ?? "linear",
    } satisfies Keyframe;
    setFrames((current) => [...current, frame]);
    setSelectedId(id);
    setMessage("");
  }

  function moveFrame(clientX: number) {
    const frameId = draggingFrameId.current;
    const track = timelineTrackRef.current;
    if (frameId === null || !track) return;
    const bounds = track.getBoundingClientRect();
    const ratio = Math.min(
      0.999999,
      Math.max(0, (clientX - bounds.left) / bounds.width),
    );
    const desiredFrame = Math.min(LAST_FRAME, Math.floor(ratio * FRAME_COUNT));
    const occupied = new Set(
      frames
        .filter((frame) => frame.id !== frameId)
        .map((frame) => frame.time),
    );
    let frame = desiredFrame;
    if (occupied.has(frame)) {
      for (let distance = 1; distance <= LAST_FRAME; distance += 1) {
        const earlier = desiredFrame - distance;
        const later = desiredFrame + distance;
        if (earlier >= 0 && !occupied.has(earlier)) {
          frame = earlier;
          break;
        }
        if (later <= LAST_FRAME && !occupied.has(later)) {
          frame = later;
          break;
        }
      }
    }
    setFrames((current) =>
      current.map((item) =>
        item.id === frameId ? { ...item, time: frame } : item,
      ),
    );
    setPlayhead(frame);
  }

  function removeKeyframe() {
    if (!selectedFrame || frames.length <= 2) {
      setMessage("Efekt musí obsahovat alespoň dva keyframy.");
      return;
    }
    const next = frames.filter((frame) => frame.id !== selectedFrame.id);
    setFrames(next);
    setSelectedId(next[0].id);
    setMessage("");
  }

  async function applyEffect() {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch("/api/shop/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          effect: {
            name: name.trim(),
            durationSeconds: 2,
            keyframes: sortedFrames.map(({ time, color, animation }) => ({
              time,
              color,
              animation,
            })),
          },
        }),
      });
      const result: { error?: string; quantity?: number } = await response.json();
      if (!response.ok || typeof result.quantity !== "number") {
        setMessage(result.error ?? "Efekt se nepodařilo použít.");
        return;
      }
      setUses(result.quantity);
      setMessage(
        result.quantity > 0
          ? `Efekt byl uložen. Zbývající použití: ${result.quantity}. Světla zatím nejsou připojená.`
          : "Efekt byl uložen. Použití spotřebováno; pro další efekt si kup další v shopu. Světla zatím nejsou připojená.",
      );
    } catch (error) {
      console.error("LED effect request failed:", error);
      setMessage("Efekt se nepodařilo použít.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
            Custom LED effect
          </p>
          <h2 className="mt-1 text-lg font-semibold">Timeline editor</h2>
        </div>
        <span className="rounded-full border border-emerald-900 bg-emerald-950/50 px-3 py-1 text-xs font-medium text-emerald-200">
          Použití v inventáři: {uses}
        </span>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1fr)_250px]">
        <div className="min-w-0 p-4 sm:p-5">
          <div className="relative flex h-44 items-center justify-center overflow-hidden rounded-lg border border-zinc-800 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-zinc-800 via-zinc-950 to-black">
            <div
              className="h-24 w-24 rounded-full blur-2xl transition-colors"
              style={{ backgroundColor: selectedFrame?.color ?? "#8b5cf6" }}
            />
            <div className="absolute text-xs font-semibold uppercase tracking-[0.25em] text-white/70">
              Náhled efektu · zařízení odpojeno
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950">
            <div className="min-w-[620px]">
              <div className="relative ml-28 h-9 border-b border-zinc-800">
                {timeLabels.map((time) => (
                  <span
                    key={time}
                    className="absolute top-2 -translate-x-1/2 text-[10px] tabular-nums text-zinc-500"
                    style={{ left: `${(time / FRAME_COUNT) * 100}%` }}
                  >
                    {formatFrameTime(time)}
                  </span>
                ))}
              </div>
              <div className="relative">
                <div className="flex h-12 border-b border-zinc-800">
                  <div className="flex w-28 shrink-0 items-center border-r border-zinc-800 px-3 text-xs font-medium text-zinc-300">
                    Barva
                  </div>
                  <div
                    ref={timelineTrackRef}
                    className="relative flex-1 touch-none"
                    onPointerMove={(event) => moveFrame(event.clientX)}
                    onPointerUp={(event) => {
                      moveFrame(event.clientX);
                      draggingFrameId.current = null;
                    }}
                    onPointerCancel={() => {
                      draggingFrameId.current = null;
                    }}
                  >
                    <div className="absolute inset-y-3 left-0 right-0 rounded bg-gradient-to-r from-violet-500 via-cyan-400 to-pink-400 opacity-30" />
                    {sortedFrames.map((frame) => (
                      <button
                        key={frame.id}
                        type="button"
                        aria-label={`Keyframe v čase ${formatFrameTime(frame.time)} sekund`}
                        aria-pressed={frame.id === selectedId}
                        onPointerDown={(event) => {
                          event.preventDefault();
                          draggingFrameId.current = frame.id;
                          setSelectedId(frame.id);
                          setPlayhead(frame.time);
                          timelineTrackRef.current?.setPointerCapture(event.pointerId);
                        }}
                        onClick={() => {
                          setSelectedId(frame.id);
                          setPlayhead(frame.time);
                        }}
                        className={`absolute top-1/2 z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border-2 ${
                          frame.id === selectedId
                            ? "border-white shadow-[0_0_12px_rgba(255,255,255,0.75)]"
                            : "border-zinc-950"
                        }`}
                        style={{
                          left: `${(frame.time / FRAME_COUNT) * 100}%`,
                          backgroundColor: frame.color,
                        }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex h-12 border-b border-zinc-800">
                  <div className="flex w-28 shrink-0 items-center border-r border-zinc-800 px-3 text-xs font-medium text-zinc-300">
                    Animace
                  </div>
                  <div className="flex flex-1 items-center gap-1 px-2">
                    {sortedFrames.slice(0, -1).map((frame, index) => {
                      const next = sortedFrames[index + 1];
                      return (
                        <div
                          key={frame.id}
                          className="h-2 rounded-full"
                          style={{
                            width: `${((next.time - frame.time) / FRAME_COUNT) * 100}%`,
                            backgroundColor: frame.animation === "pulse" ? "#f59e0b" : "#71717a",
                          }}
                        />
                      );
                    })}
                  </div>
                </div>
                <div className="relative ml-28 h-7">
                  <div
                    className="absolute bottom-0 top-0 z-20 w-px bg-white shadow-[0_0_8px_white]"
                    style={{ left: `${(playhead / FRAME_COUNT) * 100}%` }}
                  />
                </div>
                <input
                  aria-label="Pozice přehrávací hlavy"
                  type="range"
                  min="0"
                  max={LAST_FRAME}
                  step="1"
                  value={playhead}
                  onChange={(event) => setPlayhead(Number(event.currentTarget.value))}
                  className="mx-3 mb-3 block w-[calc(100%-1.5rem)] accent-violet-400"
                />
              </div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-zinc-500">
              Délka kompozice: 00:02 · 120 snímků (1/60 s) · diamant = tažitelný keyframe
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={addKeyframe}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold hover:bg-zinc-800"
              >
                + Keyframe
              </button>
              <button
                type="button"
                onClick={removeKeyframe}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold text-zinc-300 hover:border-red-900 hover:text-red-300"
              >
                Smazat keyframe
              </button>
            </div>
          </div>
        </div>

        <aside className="border-t border-zinc-800 bg-zinc-950/40 p-5 lg:border-l lg:border-t-0">
          <h3 className="font-semibold">Vlastnosti</h3>
          <label className="mt-4 block text-xs font-medium text-zinc-400">
            Název efektu
            <input
              value={name}
              maxLength={40}
              onChange={(event) => setName(event.currentTarget.value)}
              className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
            />
          </label>
          {selectedFrame && (
            <>
              <label className="mt-4 block text-xs font-medium text-zinc-400">
                Vybraný keyframe · čas
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max={LAST_FRAME}
                    step="1"
                    value={selectedFrame.time}
                    onChange={(event) => {
                      const time = Number(event.currentTarget.value);
                      if (
                        Number.isInteger(time) &&
                        time >= 0 &&
                        time <= 60 &&
                        !frames.some(
                          (frame) => frame.id !== selectedId && frame.time === time,
                        )
                      ) {
                        updateFrame({ time });
                        setPlayhead(time);
                      }
                    }}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  />
                  <span className="text-xs">snímek · {formatFrameTime(selectedFrame.time)} s</span>
                </div>
              </label>
              <label className="mt-4 block text-xs font-medium text-zinc-400">
                Barva
                <input
                  type="color"
                  value={selectedFrame.color}
                  onChange={(event) => updateFrame({ color: event.currentTarget.value })}
                  className="mt-1 h-10 w-full cursor-pointer rounded-lg border border-zinc-700 bg-zinc-950 p-1"
                />
              </label>
              <label className="mt-4 block text-xs font-medium text-zinc-400">
                Interpolace / animace
                <select
                  value={selectedFrame.animation}
                  onChange={(event) => {
                    const animation = event.currentTarget.value;
                    if (isAnimation(animation)) updateFrame({ animation });
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                >
                  <option value="steady">Stálá barva</option>
                  <option value="linear">Plynulý přechod</option>
                  <option value="pulse">Puls</option>
                </select>
              </label>
            </>
          )}
          <p className="mt-5 text-xs leading-5 text-zinc-500">
            Editor zatím ukládá návrh efektu. Fyzické LED ovládání ještě není zapojené.
          </p>
        </aside>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 bg-zinc-950/60 px-5 py-4">
        {message ? (
          <p role="status" className="max-w-2xl text-sm text-zinc-300">{message}</p>
        ) : (
          <p className="text-sm text-zinc-500">
            „Použít“ uloží efekt a odečte jeden zakoupený vstup.
          </p>
        )}
        {uses > 0 ? (
          <button
            type="button"
            disabled={busy || !name.trim() || frames.length < 2}
            onClick={() => void applyEffect()}
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {busy ? "Ukládám…" : "Použít"}
          </button>
        ) : (
          <a
            href="/shop"
            className="rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-bold hover:bg-violet-500"
          >
            Dokoupit v shopu
          </a>
        )}
      </div>
    </section>
  );
}
