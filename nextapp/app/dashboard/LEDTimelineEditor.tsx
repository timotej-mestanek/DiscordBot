"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CustomLedLayout, LED_COUNT } from "@/app/overlays/CustomLedEffectOverlay";
import {
  COOKIE_CONSENT_EVENT,
  getCookieConsent,
  requestCookieConsent,
  type CookieConsent,
} from "@/lib/cookie-consent";

type Animation = "steady" | "linear" | "ease-in" | "ease-out" | "ease-in-out" | "pulse" | "fill";
type Keyframe = {
  id: number;
  time: number;
  color: string;
  opacity: number;
  animation: Animation;
  ledIds: number[] | null;
};

type SavedDraft = {
  version: 1;
  name: string;
  durationSeconds: number;
  frames: Keyframe[];
};

const FPS = 60;
const MAX_DURATION_SECONDS = 10;
const MAX_FRAME_COUNT = FPS * MAX_DURATION_SECONDS;
const MAX_KEYFRAMES = MAX_FRAME_COUNT;
const LED_DRAFT_STORAGE_KEY = "n4jt-led-effect-draft";
const initialFrames: Keyframe[] = [
  { id: 1, time: 0, color: "#8b5cf6", opacity: 1, animation: "linear", ledIds: null },
  { id: 2, time: 30, color: "#22d3ee", opacity: 1, animation: "pulse", ledIds: null },
  { id: 3, time: 72, color: "#f472b6", opacity: 1, animation: "ease-in-out", ledIds: null },
  { id: 4, time: 119, color: "#8b5cf6", opacity: 1, animation: "steady", ledIds: null },
];
const TIMELINE_LABEL_WIDTH = 96;
const ledStrips = [
  { label: "Top", start: 0, end: 99 },
  { label: "Right", start: 100, end: 171 },
  { label: "Bottom", start: 172, end: 210 },
  { label: "Left", start: 211, end: 240 },
  { label: "Short", start: 241, end: 248 },
  { label: "Hexagons", start: 249, end: 332 },
];

function formatFrameTime(frame: number) {
  const seconds = frame / 60;
  return `00:${seconds.toFixed(3).padStart(6, "0")}`;
}

function isAnimation(value: string): value is Animation {
  return value === "steady" ||
    value === "linear" ||
    value === "ease-in" ||
    value === "ease-out" ||
    value === "ease-in-out" ||
    value === "pulse" ||
    value === "fill";
}

function isKeyframe(value: unknown): value is Keyframe {
  if (typeof value !== "object" || value === null) return false;
  const frame = value as Record<string, unknown>;
  return (
    typeof frame.id === "number" &&
    Number.isInteger(frame.id) &&
    typeof frame.time === "number" &&
    Number.isInteger(frame.time) &&
    typeof frame.color === "string" &&
    /^#[0-9a-fA-F]{6}$/.test(frame.color) &&
    typeof frame.opacity === "number" &&
    Number.isFinite(frame.opacity) &&
    frame.opacity >= 0 &&
    frame.opacity <= 1 &&
    typeof frame.animation === "string" &&
    isAnimation(frame.animation) &&
    (frame.ledIds === null ||
      (Array.isArray(frame.ledIds) &&
        frame.ledIds.length > 0 &&
        frame.ledIds.every(
          (ledId) =>
            typeof ledId === "number" &&
            Number.isInteger(ledId) &&
            ledId >= 0 &&
            ledId < LED_COUNT,
        )))
  );
}

function isSavedDraft(value: unknown): value is SavedDraft {
  if (typeof value !== "object" || value === null) return false;
  const draft = value as Record<string, unknown>;
  const durationSeconds = draft.durationSeconds;
  return (
    draft.version === 1 &&
    typeof draft.name === "string" &&
    draft.name.trim().length > 0 &&
    draft.name.length <= 40 &&
    typeof draft.durationSeconds === "number" &&
    Number.isInteger(draft.durationSeconds) &&
    draft.durationSeconds >= 1 &&
    draft.durationSeconds <= MAX_DURATION_SECONDS &&
    Array.isArray(draft.frames) &&
    draft.frames.length >= 2 &&
    draft.frames.length <= MAX_KEYFRAMES &&
    draft.frames.every(
      (frame) =>
        isKeyframe(frame) &&
        frame.time >= 0 &&
        typeof durationSeconds === "number" &&
        frame.time < durationSeconds * FPS,
    )
  );
}

function mixColor(from: string, to: string, ratio: number) {
  const channels = [1, 3, 5].map((offset) => {
    const start = Number.parseInt(from.slice(offset, offset + 2), 16);
    const end = Number.parseInt(to.slice(offset, offset + 2), 16);
    return Math.round(start + (end - start) * ratio);
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function getEasedProgress(animation: Animation, progress: number) {
  switch (animation) {
    case "ease-in":
      return progress * progress;
    case "ease-out":
      return 1 - (1 - progress) ** 2;
    case "ease-in-out":
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - (-2 * progress + 2) ** 2 / 2;
    default:
      return progress;
  }
}

function getLedValue(frames: Keyframe[], time: number, ledId: number) {
  const targetFrames = frames.filter(
    (frame) => frame.ledIds === null || frame.ledIds.includes(ledId),
  );
  const previous = [...targetFrames].reverse().find((frame) => frame.time <= time) ?? targetFrames[0];
  const next = targetFrames.find((frame) => frame.time > time);
  if (!previous || !next || previous.animation === "steady") {
    return { color: previous?.color ?? "#16a34a", opacity: previous?.opacity ?? 1 };
  }

  const progress = (time - previous.time) / (next.time - previous.time);
  if (previous.animation === "pulse") {
    const pulse = 0.35 + (Math.sin(progress * Math.PI * 8 - Math.PI / 2) + 1) * 0.325;
    return {
      color: mixColor("#000000", previous.color, pulse),
      opacity: previous.opacity,
    };
  }

  const cohort = previous.ledIds
    ? [...previous.ledIds].sort((left, right) => left - right)
    : Array.from({ length: LED_COUNT }, (_, id) => id);
  const fillProgress =
    previous.animation === "fill"
      ? Math.max(
          0,
          Math.min(
            1,
            progress * cohort.length - cohort.indexOf(ledId),
          ),
        )
      : null;
  const eased =
    fillProgress ?? getEasedProgress(previous.animation, progress);
  return {
    color: mixColor(previous.color, next.color, eased),
    opacity: previous.opacity + (next.opacity - previous.opacity) * eased,
  };
}

export default function LEDTimelineEditor({ initialUses }: { initialUses: number }) {
  const [uses, setUses] = useState(initialUses);
  const [frames, setFrames] = useState(initialFrames);
  const [selectedId, setSelectedId] = useState(initialFrames[0].id);
  const [playhead, setPlayhead] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(2);
  const [cookieConsent, setCookieConsent] = useState<CookieConsent>("unset");
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineViewportWidth, setTimelineViewportWidth] = useState(0);
  const [name, setName] = useState("My LED effect");
  const [message, setMessage] = useState("");
  const [showConsentNotice, setShowConsentNotice] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLedIds, setSelectedLedIds] = useState<number[]>([]);
  const editorRef = useRef<HTMLElement>(null);
  const playbackStartFrame = useRef(0);
  const timelineViewportRef = useRef<HTMLDivElement>(null);
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const draggingFrameId = useRef<number | null>(null);
  const scrubbingTimeline = useRef(false);
  const frameCount = durationSeconds * FPS;
  const lastFrame = frameCount - 1;
  const timelineContentWidth =
    Math.max(0, timelineViewportWidth - TIMELINE_LABEL_WIDTH) * timelineZoom;
  const timeLabels = Array.from({ length: 5 }, (_, index) =>
    Math.round((frameCount * index) / 4),
  );
  const selectedFrame = frames.find((frame) => frame.id === selectedId) ?? frames[0];
  const sortedFrames = useMemo(
    () => [...frames].sort((left, right) => left.time - right.time),
    [frames],
  );
  const previewValues = useMemo(
    () => Array.from({ length: LED_COUNT }, (_, ledId) => getLedValue(sortedFrames, playhead, ledId)),
    [playhead, sortedFrames],
  );
  const previewColors = previewValues.map((value) => value.color);
  const previewOpacity = previewValues.map((value) => value.opacity);

  useEffect(() => {
    function syncConsentAndDraft() {
      const consent = getCookieConsent();
      setCookieConsent(consent);
      if (consent === "declined") {
        try {
          window.localStorage.removeItem(LED_DRAFT_STORAGE_KEY);
        } catch (error) {
          console.error("Could not remove the declined LED draft:", error);
          setMessage("Could not remove the saved LED draft from storage.");
        }
        return;
      }
      if (consent !== "accepted") return;

      try {
        const storedDraft = window.localStorage.getItem(LED_DRAFT_STORAGE_KEY);
        if (!storedDraft) return;
        const parsed: unknown = JSON.parse(storedDraft);
        if (!isSavedDraft(parsed)) {
          throw new Error("Saved LED draft has an invalid format.");
        }
        setName(parsed.name);
        setDurationSeconds(parsed.durationSeconds);
        setFrames(parsed.frames);
        setSelectedId(parsed.frames[0].id);
        setPlayhead(0);
        setSelectedLedIds([]);
        setMessage(`Loaded saved draft “${parsed.name}”.`);
      } catch (error) {
        console.error("Could not load the saved LED draft:", error);
        setMessage("The saved LED draft is corrupted and could not be loaded.");
      }
    }
    syncConsentAndDraft();
    window.addEventListener(COOKIE_CONSENT_EVENT, syncConsentAndDraft);
    return () => window.removeEventListener(COOKIE_CONSENT_EVENT, syncConsentAndDraft);
  }, []);

  useEffect(() => {
    const syncFullscreen = () => {
      setIsFullscreen(document.fullscreenElement === editorRef.current);
    };
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  useEffect(() => {
    const viewport = timelineViewportRef.current;
    if (!viewport) return;
    const observer = new ResizeObserver(() => {
      setTimelineViewportWidth(viewport.clientWidth);
    });
    observer.observe(viewport);
    setTimelineViewportWidth(viewport.clientWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleSpacebar = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.target instanceof HTMLElement &&
          (event.target.isContentEditable ||
            ["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName))
      ) {
        return;
      }
      event.preventDefault();
      togglePlayback();
    };
    window.addEventListener("keydown", handleSpacebar);
    return () => window.removeEventListener("keydown", handleSpacebar);
  });

  useEffect(() => {
    if (!playing) return;
    const startFrame = playbackStartFrame.current;
    const startTime = performance.now();
    const timer = window.setInterval(() => {
      const elapsedFrames = ((performance.now() - startTime) * FPS) / 1_000;
      const nextFrame = Math.min(lastFrame, startFrame + elapsedFrames);
      setPlayhead(nextFrame);
      if (nextFrame >= lastFrame) setPlaying(false);
    }, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [lastFrame, playing]);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement === editorRef.current) {
        await document.exitFullscreen();
      } else if (editorRef.current?.requestFullscreen) {
        await editorRef.current.requestFullscreen();
      } else {
        setMessage("Fullscreen is not available in this browser.");
      }
    } catch (error) {
      console.error("Could not toggle LED preview fullscreen:", error);
      setMessage("Could not switch the preview to fullscreen.");
    }
  }

  function togglePlayback() {
    if (playing) {
      setPlaying(false);
      return;
    }
    playbackStartFrame.current = playhead >= lastFrame ? 0 : playhead;
    if (playhead >= lastFrame) setPlayhead(0);
    setPlaying(true);
  }

  function createNewDraft() {
    setPlaying(false);
    setFrames(initialFrames);
    setSelectedId(initialFrames[0].id);
    setPlayhead(0);
    setDurationSeconds(2);
    setName("My LED effect");
    setSelectedLedIds([]);
    playbackStartFrame.current = 0;
    setMessage("New LED draft ready. It is saved in this browser only.");
  }

  function saveDraft() {
    const consent = getCookieConsent();
    setCookieConsent(consent);
    if (consent !== "accepted") {
      setShowConsentNotice(true);
      return;
    }

    const draft: SavedDraft = {
      version: 1,
      name: name.trim() || "My LED effect",
      durationSeconds,
      frames: sortedFrames,
    };
    try {
      window.localStorage.setItem(LED_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setName(draft.name);
      setMessage(`Draft “${draft.name}” saved in this browser only.`);
    } catch (error) {
      console.error("Could not save the LED draft locally:", error);
      setMessage("Could not save the LED draft to local storage.");
    }
  }

  function updateFrame(changes: Partial<Omit<Keyframe, "id">>) {
    if (!selectedFrame) return;
    if (selectedLedIds.length > 0 && selectedFrame.ledIds === null) {
      if (frames.length >= MAX_KEYFRAMES) {
        setMessage(`The effect already contains the maximum of ${MAX_KEYFRAMES} keyframes.`);
        return;
      }
      const conflictingFrame = frames.find(
        (frame) =>
          frame.time === (changes.time ?? selectedFrame.time) &&
          frame.ledIds !== null &&
          frame.ledIds.some((ledId) => selectedLedIds.includes(ledId)),
      );
      if (conflictingFrame) {
        setMessage("A separate keyframe already exists for these LEDs at this time.");
        return;
      }
      const id = Math.max(...frames.map((frame) => frame.id), 0) + 1;
      const scopedFrame = {
        ...selectedFrame,
        ...changes,
        id,
        ledIds: selectedLedIds,
      };
      setFrames((current) => [...current, scopedFrame]);
      setSelectedId(id);
      setMessage("");
      return;
    }
    setFrames((current) =>
      current.map((frame) =>
        frame.id === selectedFrame.id ? { ...frame, ...changes } : frame,
      ),
    );
  }

  function addKeyframe() {
    if (frames.length >= MAX_KEYFRAMES) {
      setMessage(`The effect already contains the maximum of ${MAX_KEYFRAMES} keyframes.`);
      return;
    }
    const exactTimeFrames = frames.filter((frame) => frame.time === playhead);
    if (selectedLedIds.length === 0 && exactTimeFrames.length > 0) {
      setSelectedId(exactTimeFrames[0].id);
      setMessage("A keyframe already exists at this position.");
      return;
    }
    if (
      selectedLedIds.length > 0 &&
      exactTimeFrames.some(
        (frame) =>
          frame.ledIds !== null &&
          frame.ledIds.some((ledId) => selectedLedIds.includes(ledId)),
      )
    ) {
      setMessage("A keyframe for one of the selected LEDs already exists at this position.");
      return;
    }
    const id = Math.max(...frames.map((frame) => frame.id), 0) + 1;
    const frame = {
      id,
      time: playhead,
      color: selectedFrame?.color ?? "#8b5cf6",
      opacity: selectedFrame?.opacity ?? 1,
      animation: selectedFrame?.animation ?? "linear",
      ledIds: selectedLedIds.length ? selectedLedIds : null,
    } satisfies Keyframe;
    setFrames((current) => [...current, frame]);
    setSelectedId(id);
    setMessage("");
  }

  function loadExample(
    preset: "fade" | "pulse" | "color-flow",
  ) {
    const exampleLastFrame = 2 * FPS - 1;
    const presets: Record<
      typeof preset,
      { name: string; keyframes: Omit<Keyframe, "id">[] }
    > = {
      fade: {
        name: "Slow fade-in · 2 s",
        keyframes: [
          { time: 0, color: "#8b5cf6", opacity: 0, animation: "ease-in-out", ledIds: null },
          { time: exampleLastFrame, color: "#8b5cf6", opacity: 1, animation: "steady", ledIds: null },
        ],
      },
      pulse: {
        name: "Pulse · 2 s",
        keyframes: [0, 30, 60, 90, exampleLastFrame].map((time, index) => ({
          time,
          color: "#22d3ee",
          opacity: index % 2 === 0 ? 0.2 : 1,
          animation: "ease-in-out",
          ledIds: null,
        })),
      },
      "color-flow": {
        name: "Color transition · 2 s",
        keyframes: [
          { time: 0, color: "#8b5cf6", opacity: 1, animation: "linear", ledIds: null },
          { time: 60, color: "#22d3ee", opacity: 1, animation: "linear", ledIds: null },
          { time: exampleLastFrame, color: "#f472b6", opacity: 1, animation: "steady", ledIds: null },
        ],
      },
    };
    const selectedPreset = presets[preset];
    const nextFrames = selectedPreset.keyframes.map((frame, index) => ({
      ...frame,
      id: index + 1,
    }));
    setFrames(nextFrames);
    setSelectedId(nextFrames[0].id);
    setPlayhead(0);
    setDurationSeconds(2);
    playbackStartFrame.current = 0;
    setPlaying(false);
    setName(selectedPreset.name);
    setMessage("");
  }

  function selectStrip(start: number, end: number) {
    const stripIds = Array.from({ length: end - start + 1 }, (_, index) => start + index);
    const selected = new Set(selectedLedIds);
    const isFullySelected = stripIds.every((id) => selected.has(id));
    if (isFullySelected) {
      stripIds.forEach((id) => selected.delete(id));
    } else {
      stripIds.forEach((id) => selected.add(id));
    }
    setSelectedLedIds([...selected].sort((left, right) => left - right));
  }

  function zoomTimeline(event: React.WheelEvent<HTMLDivElement>) {
    if (!event.altKey) return;
    event.preventDefault();
    const previousZoom = timelineZoom;
    const nextZoom = Math.min(
      8,
      Math.max(1, previousZoom * (event.deltaY < 0 ? 1.2 : 1 / 1.2)),
    );
    if (nextZoom === previousZoom) return;

    const viewport = timelineViewportRef.current;
    if (viewport && timelineContentWidth > 0) {
      const bounds = viewport.getBoundingClientRect();
      const lanePosition =
        viewport.scrollLeft + event.clientX - bounds.left - TIMELINE_LABEL_WIDTH;
      const anchorRatio = Math.max(
        0,
        Math.min(1, lanePosition / timelineContentWidth),
      );
      const nextContentWidth =
        Math.max(0, viewport.clientWidth - TIMELINE_LABEL_WIDTH) * nextZoom;
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          viewport.scrollLeft =
            TIMELINE_LABEL_WIDTH +
            anchorRatio * nextContentWidth -
            (event.clientX - bounds.left);
        });
      });
    }
    setTimelineZoom(nextZoom);
  }

  function moveFrame(clientX: number) {
    const track = timelineTrackRef.current;
    if (!track) return;
    const bounds = track.getBoundingClientRect();
    const ratio = Math.min(
      0.999999,
      Math.max(0, (clientX - bounds.left) / bounds.width),
    );
    const desiredFrame = Math.min(lastFrame, Math.floor(ratio * frameCount));
    const frameId = draggingFrameId.current;
    if (frameId === null) {
      if (scrubbingTimeline.current) {
        setPlaying(false);
        setPlayhead(desiredFrame);
      }
      return;
    }
    setPlaying(false);
    const occupied = new Set(
      frames
        .filter((frame) => frame.id !== frameId)
        .map((frame) => frame.time),
    );
    let frame = desiredFrame;
    if (occupied.has(frame)) {
      for (let distance = 1; distance <= lastFrame; distance += 1) {
        const earlier = desiredFrame - distance;
        const later = desiredFrame + distance;
        if (earlier >= 0 && !occupied.has(earlier)) {
          frame = earlier;
          break;
        }
        if (later <= lastFrame && !occupied.has(later)) {
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
      setMessage("The effect must contain at least two keyframes.");
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
            durationSeconds,
            keyframes: sortedFrames.map(({ time, color, animation, opacity, ledIds }) => ({
              time,
              color,
              animation,
              opacity,
              ledIds,
            })),
          },
        }),
      });
      const result: { error?: string; quantity?: number } = await response.json();
      if (!response.ok || typeof result.quantity !== "number") {
        setMessage(result.error ?? "Could not apply the effect.");
        return;
      }
      setUses(result.quantity);
      setMessage(
        result.quantity > 0
          ? `Effect saved. Uses remaining: ${result.quantity}. The lights are not connected yet.`
          : "Effect saved and use consumed. Buy another in the shop to apply another effect. The lights are not connected yet.",
      );
    } catch (error) {
      console.error("LED effect request failed:", error);
      setMessage("Could not apply the effect.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section
      ref={editorRef}
      className={`flex flex-col overflow-hidden border border-zinc-800 bg-[#202020] text-zinc-200 ${
        isFullscreen
          ? "h-screen w-screen min-h-0 rounded-none border-0"
          : "h-[min(82vh,900px)] min-h-[480px] rounded-xl"
      }`}
    >
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-black bg-[#292929] px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded bg-violet-600 text-xs font-black text-white">LED</span>
          <div className="min-w-0">
            <h2 className="truncate text-sm font-semibold">{name || "New LED composition"}</h2>
            <p className="text-[10px] uppercase tracking-[0.16em] text-zinc-500">Custom LED effect · 60 fps</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden text-xs tabular-nums text-zinc-400 sm:inline">
            {formatFrameTime(Math.floor(playhead))}
          </span>
          <span className="rounded bg-[#383838] px-2 py-1 text-[10px] text-zinc-300">Uses: {uses}</span>
          <button
            type="button"
            onClick={createNewDraft}
            className="rounded border border-zinc-600 px-2.5 py-1.5 text-xs font-semibold hover:bg-zinc-700"
          >
            NEW
          </button>
          <button
            type="button"
            onClick={saveDraft}
            title={
              cookieConsent === "accepted"
                ? "Save draft in this browser only"
                : "Show consent settings for local storage"
            }
            className="rounded border border-violet-500 bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-500"
          >
            SAVE
          </button>
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="rounded border border-zinc-600 px-2.5 py-1.5 text-xs hover:bg-zinc-700"
          >
            {isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_260px]">
        <main className="flex min-h-0 min-w-0 flex-col border-b border-black p-2 lg:border-b-0 lg:border-r">
          <div className="flex h-8 shrink-0 items-center justify-between rounded-t border border-[#111] bg-[#292929] px-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
              Composition · LED preview
            </span>
            <div className="flex items-center gap-2">
              <span className="text-[10px] tabular-nums text-zinc-500">{formatFrameTime(Math.floor(playhead))}</span>
              <button
                type="button"
                onClick={togglePlayback}
                aria-pressed={playing}
                title="Press Space to play or pause the effect"
                className="min-w-20 rounded bg-[#414141] px-2 py-1 text-[10px] font-semibold text-zinc-100 hover:bg-[#505050]"
              >
                {playing ? "❚❚ Pause" : "▶ Play"}
              </button>
              <span className="hidden text-[9px] text-zinc-600 sm:inline">Space</span>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden border-x border-b border-[#111] bg-[#151515] p-2">
            <CustomLedLayout
              className="h-full w-full"
              colors={previewColors}
              opacity={previewOpacity}
              selectedLedIds={selectedLedIds}
              onLedSelectionChange={setSelectedLedIds}
            />
          </div>
        </main>

        <aside className="min-h-0 overflow-y-auto bg-[#262626]">
          <div className="flex h-9 items-center border-b border-black bg-[#303030] px-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
            Properties
          </div>
          <div className="space-y-4 p-3">
            <div className="flex items-center justify-between gap-2 rounded border border-zinc-700 bg-[#1e1e1e] px-2 py-2">
              <span className="text-[10px] text-zinc-300">
                {selectedLedIds.length
                  ? `Selected LEDs: ${selectedLedIds.length}`
                  : "All LEDs"}
              </span>
              {selectedLedIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedLedIds([])}
                  className="cursor-pointer text-[10px] text-violet-300 hover:text-violet-200"
                >
                  Clear selection
                </button>
              )}
            </div>
            <p className="text-[9px] leading-4 text-zinc-500">
              Click = one LED · Ctrl/Cmd = add/remove · Shift = range · drag = area selection
            </p>
            <div className="space-y-2 border-t border-zinc-700 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Strip selection
              </p>
              <div className="grid grid-cols-2 gap-1">
                {ledStrips.map((strip) => {
                  const stripLength = strip.end - strip.start + 1;
                  const selectedCount = selectedLedIds.filter(
                    (id) => id >= strip.start && id <= strip.end,
                  ).length;
                  const isFullySelected = selectedCount === stripLength;
                  const isPartiallySelected = selectedCount > 0 && !isFullySelected;
                  return (
                    <button
                      key={strip.label}
                      type="button"
                      aria-pressed={
                        isFullySelected ? true : isPartiallySelected ? "mixed" : false
                      }
                      onClick={() => selectStrip(strip.start, strip.end)}
                      className={`flex items-center justify-between gap-1 rounded border px-2 py-1.5 text-left text-[10px] hover:text-white ${
                        isFullySelected
                          ? "border-violet-400 bg-violet-950/70 text-violet-100"
                          : isPartiallySelected
                            ? "border-cyan-700 bg-cyan-950/50 text-cyan-100"
                            : "border-zinc-700 bg-[#1e1e1e] text-zinc-300 hover:border-violet-400"
                      }`}
                    >
                      <span>{strip.label}</span>
                      <span className="tabular-nums text-[9px] opacity-80">
                        {selectedCount}/{stripLength}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2 border-t border-zinc-700 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                Example animations · 2 s
              </p>
              <div className="grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => loadExample("fade")}
                  className="rounded border border-zinc-700 bg-[#1e1e1e] px-2 py-1.5 text-[10px] text-zinc-300 hover:border-violet-400"
                >
                  Fade in
                </button>
                <button
                  type="button"
                  onClick={() => loadExample("pulse")}
                  className="rounded border border-zinc-700 bg-[#1e1e1e] px-2 py-1.5 text-[10px] text-zinc-300 hover:border-violet-400"
                >
                  Pulse
                </button>
                <button
                  type="button"
                  onClick={() => loadExample("color-flow")}
                  className="col-span-2 rounded border border-zinc-700 bg-[#1e1e1e] px-2 py-1.5 text-[10px] text-zinc-300 hover:border-violet-400"
                >
                  Color transition
                </button>
              </div>
            </div>
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
              Effect name
              <input
                value={name}
                maxLength={40}
                onChange={(event) => setName(event.currentTarget.value)}
                className="mt-1.5 w-full rounded border border-[#111] bg-[#191919] px-2.5 py-2 text-xs normal-case text-white outline-none focus:border-violet-500"
              />
            </label>
            {selectedFrame && (
              <>
                <div className="border-t border-zinc-700 pt-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Selected keyframe</p>
                  <label className="block text-[10px] text-zinc-500">
                    Frame
                    <div className="mt-1 flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={lastFrame}
                        step="1"
                        value={selectedFrame.time}
                        onChange={(event) => {
                          const time = Number(event.currentTarget.value);
                          if (
                            Number.isInteger(time) &&
                            time >= 0 &&
                            time <= lastFrame &&
                            !frames.some((frame) => frame.id !== selectedId && frame.time === time)
                          ) {
                            updateFrame({ time });
                            setPlayhead(time);
                          }
                        }}
                        className="w-20 rounded border border-[#111] bg-[#191919] px-2 py-1.5 text-xs text-white"
                      />
                      <span className="text-[10px] tabular-nums">{formatFrameTime(selectedFrame.time)}</span>
                    </div>
                  </label>
                </div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Color
                  <input
                    type="color"
                    value={selectedFrame.color}
                    onChange={(event) => updateFrame({ color: event.currentTarget.value })}
                    className="mt-1.5 h-9 w-full cursor-pointer rounded border border-[#111] bg-[#191919] p-1"
                  />
                </label>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Interpolation
                  <select
                    value={selectedFrame.animation}
                    onChange={(event) => {
                      const animation = event.currentTarget.value;
                      if (isAnimation(animation)) updateFrame({ animation });
                    }}
                    className="mt-1.5 w-full rounded border border-[#111] bg-[#191919] px-2 py-2 text-xs font-normal normal-case text-white"
                  >
                    <option value="steady">Steady</option>
                    <option value="linear">Linear</option>
                    <option value="ease-in">Ease in</option>
                    <option value="ease-out">Ease out</option>
                    <option value="ease-in-out">Ease in and out</option>
                    <option value="pulse">Pulse</option>
                    <option value="fill">Fill · progressive lighting</option>
                  </select>
                </label>
                {selectedFrame.animation === "fill" && (
                  <p className="text-[9px] leading-4 text-cyan-200/80">
                    LEDs light up in ID order until the next keyframe.
                    For a full-cycle effect, use the same color at both points, set
                    opacity to 0% at the start and 100% at the end, and set the duration to 3 s.
                  </p>
                )}
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                  Opacity
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={selectedFrame.opacity}
                    onChange={(event) =>
                      updateFrame({ opacity: Number(event.currentTarget.value) })
                    }
                    className="mt-2 block w-full accent-violet-400"
                  />
                  <span className="mt-1 block text-right text-[10px] tabular-nums text-zinc-500">
                    {Math.round(selectedFrame.opacity * 100)} %
                  </span>
                </label>
                <p className="border-t border-zinc-700 pt-3 text-[10px] leading-5 text-zinc-500">
                  {selectedFrame.ledIds
                    ? `Keyframe targets ${selectedFrame.ledIds.length} LEDs.`
                    : "Keyframe targets all LEDs."}
                </p>
              </>
            )}
          </div>
        </aside>
      </div>

      <section className="h-[240px] min-w-0 shrink-0 overflow-hidden border-t border-black bg-[#202020] px-3">
        <div className="flex h-9 min-w-0 items-center justify-between gap-2 border-b border-black bg-[#292929] px-3">
          <div className="flex items-center gap-3">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-300">Timeline</span>
            <span className="text-[10px] tabular-nums text-zinc-500">{formatFrameTime(Math.floor(playhead))}</span>
          </div>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={addKeyframe}
              className="rounded border border-zinc-600 bg-[#383838] px-2 py-1 text-[10px] font-semibold hover:bg-[#4a4a4a]"
            >
              {selectedLedIds.length
                ? `+ Keyframe (${selectedLedIds.length} LED)`
                : "+ Keyframe"}
            </button>
            <button
              type="button"
              onClick={removeKeyframe}
              className="rounded border border-zinc-600 bg-[#383838] px-2 py-1 text-[10px] font-semibold hover:border-red-800 hover:bg-[#4a4a4a]"
            >
              − Delete
            </button>
            <label className="flex items-center gap-1 text-[10px] text-zinc-400">
              Duration
              <select
                value={durationSeconds}
                onChange={(event) => {
                  const nextDuration = Number(event.currentTarget.value);
                  if (
                    Number.isInteger(nextDuration) &&
                    nextDuration >= 1 &&
                    nextDuration <= MAX_DURATION_SECONDS &&
                    !frames.some((frame) => frame.time >= nextDuration * FPS)
                  ) {
                    setDurationSeconds(nextDuration);
                    setPlayhead((current) =>
                      Math.min(current, nextDuration * FPS - 1),
                    );
                    setMessage("");
                  }
                }}
                className="rounded border border-zinc-600 bg-[#202020] px-1.5 py-1 text-[10px] text-zinc-200"
                aria-label="Animation duration in seconds"
              >
                {Array.from({ length: MAX_DURATION_SECONDS }, (_, index) => index + 1).map(
                  (seconds) => (
                    <option
                      key={seconds}
                      value={seconds}
                      disabled={frames.some((frame) => frame.time >= seconds * FPS)}
                    >
                      {seconds} s
                    </option>
                  ),
                )}
              </select>
            </label>
            <span className="hidden text-[9px] text-zinc-500 md:inline">
              Alt + scroll: zoom · {Math.round(timelineZoom * 100)}%
            </span>
          </div>
        </div>
        <div
          ref={timelineViewportRef}
          className={`h-[calc(100%-36px)] min-w-0 ${
            timelineZoom > 1 ? "overflow-auto" : "overflow-hidden"
          }`}
          onWheel={zoomTimeline}
        >
          <div
            className="relative h-full min-w-full"
            style={{ width: TIMELINE_LABEL_WIDTH + timelineContentWidth }}
          >
            <div className="flex h-7 border-b border-black">
              <div className="w-24 shrink-0 border-r border-black bg-[#292929]" />
              <div
                className="relative mx-2 shrink-0"
                style={{ width: timelineContentWidth }}
              >
                <div className="absolute inset-x-2 inset-y-0">
                  {timeLabels.map((time) => (
                    <span
                      key={time}
                      className={`absolute top-1.5 text-[9px] tabular-nums text-zinc-500 ${
                        time === 0 ? "" : time === frameCount ? "-translate-x-full" : "-translate-x-1/2"
                      }`}
                      style={{ left: `${(time / frameCount) * 100}%` }}
                    >
                      {formatFrameTime(time)}
                    </span>
                  ))}
                  <span
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-400"
                    style={{ left: `${(playhead / frameCount) * 100}%` }}
                  />
                </div>
              </div>
            </div>
            <div className="relative h-[calc(100%-28px)]">
              <div className="relative flex h-14 border-b border-black">
                <div className="flex w-24 shrink-0 items-center gap-2 border-r border-black bg-[#292929] px-2 text-[10px] text-zinc-300">
                  <span className="text-violet-300">◆</span> LED color
                </div>
                <div
                  className="relative flex min-h-14 shrink-0 cursor-pointer touch-none bg-[#242424]"
                  style={{ width: timelineContentWidth }}
                  onPointerDown={(event) => {
                    if ((event.target as Element).closest("[data-keyframe]")) return;
                    scrubbingTimeline.current = true;
                    event.currentTarget.setPointerCapture(event.pointerId);
                    moveFrame(event.clientX);
                  }}
                  onPointerMove={(event) => moveFrame(event.clientX)}
                  onPointerUp={(event) => {
                    moveFrame(event.clientX);
                    draggingFrameId.current = null;
                    scrubbingTimeline.current = false;
                  }}
                  onPointerCancel={() => {
                    draggingFrameId.current = null;
                    scrubbingTimeline.current = false;
                  }}
                >
                  <div ref={timelineTrackRef} className="absolute inset-x-2 inset-y-0">
                  {timeLabels.map((time) => (
                    <span
                      key={time}
                      className="pointer-events-none absolute inset-y-0 w-px bg-white/[0.04]"
                      style={{ left: `${(time / frameCount) * 100}%` }}
                    />
                  ))}
                  <span
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-400"
                    style={{ left: `${(playhead / frameCount) * 100}%` }}
                  />
                  {sortedFrames.map((frame) => {
                    const sameTimeFrames = sortedFrames.filter((item) => item.time === frame.time);
                    const stackIndex = sameTimeFrames.findIndex((item) => item.id === frame.id);
                    return (
                    <button
                      key={frame.id}
                      type="button"
                      aria-label={`Keyframe at ${formatFrameTime(frame.time)}${
                        frame.ledIds ? ` for ${frame.ledIds.length} LEDs` : " for all LEDs"
                      }`}
                      aria-pressed={frame.id === selectedId}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        setPlaying(false);
                        draggingFrameId.current = frame.id;
                        setSelectedId(frame.id);
                        setPlayhead(frame.time);
                        timelineTrackRef.current?.setPointerCapture(event.pointerId);
                      }}
                      onClick={() => {
                        setPlaying(false);
                        setSelectedId(frame.id);
                        setPlayhead(frame.time);
                      }}
                      className={`absolute z-10 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rotate-45 border ${
                        frame.id === selectedId
                          ? "border-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                          : frame.ledIds
                            ? "border-cyan-200"
                            : "border-black"
                      }`}
                      data-keyframe
                      style={{
                        left: `${(frame.time / frameCount) * 100}%`,
                        top: `calc(50% + ${(stackIndex - (sameTimeFrames.length - 1) / 2) * 9}px)`,
                        backgroundColor: frame.color,
                      }}
                    />
                    );
                  })}
                  </div>
                </div>
              </div>
              <div className="flex h-12 border-b border-black">
                <div className="flex w-24 shrink-0 items-center gap-2 border-r border-black bg-[#292929] px-2 text-[10px] text-zinc-300">
                  <span className="text-amber-300">▰</span> Animation
                </div>
                <div
                  className="relative flex shrink-0 overflow-hidden bg-[#242424]"
                  style={{ width: timelineContentWidth }}
                >
                  <div className="absolute inset-x-2 inset-y-0 flex items-center">
                  {sortedFrames.slice(0, -1).map((frame, index) => {
                    const next = sortedFrames[index + 1];
                    return (
                      <div
                        key={frame.id}
                        className="h-5 shrink-0 border border-black/30"
                        style={{
                          width: `${((next.time - frame.time) / frameCount) * 100}%`,
                          backgroundColor:
                            frame.animation === "pulse"
                              ? "#806020"
                              : frame.animation === "fill"
                                ? "#0e7490"
                              : frame.animation === "steady"
                                ? "#3f3f46"
                                : frame.animation.startsWith("ease")
                                  ? "#4f46e5"
                                  : "#4b5563",
                        }}
                      />
                    );
                  })}
                  <span
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-400"
                    style={{ left: `${(playhead / frameCount) * 100}%` }}
                  />
                  </div>
                </div>
              </div>
              <div className="relative flex h-10 border-b border-black">
                <div className="flex w-24 shrink-0 items-center gap-2 border-r border-black bg-[#292929] px-2 text-[10px] text-zinc-300">
                  <span className="text-cyan-300">◧</span> Opacity
                </div>
                <div
                  className="relative flex shrink-0 overflow-hidden bg-[#242424]"
                  style={{ width: timelineContentWidth }}
                >
                  <div className="absolute inset-x-2 inset-y-0 flex items-center">
                  {sortedFrames.slice(0, -1).map((frame, index) => {
                    const next = sortedFrames[index + 1];
                    return (
                      <div
                        key={frame.id}
                        className="h-4 shrink-0 border border-black/30 bg-cyan-500"
                        style={{
                          width: `${((next.time - frame.time) / frameCount) * 100}%`,
                          opacity: frame.opacity,
                        }}
                      />
                    );
                  })}
                  <span
                    className="pointer-events-none absolute inset-y-0 z-20 w-px bg-red-400"
                    style={{ left: `${(playhead / frameCount) * 100}%` }}
                  />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {showConsentNotice && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/70 p-4"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="led-save-consent-title"
            className="w-full max-w-md rounded-xl border border-zinc-700 bg-[#202020] p-5 text-zinc-100 shadow-2xl"
          >
            <h2 id="led-save-consent-title" className="text-sm font-semibold">
              Consent is required to save
            </h2>
            <p className="mt-2 text-xs leading-5 text-zinc-300">
              The LED draft is saved only in this browser&apos;s local storage.
              You must first allow optional storage.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConsentNotice(false)}
                className="rounded border border-zinc-600 px-3 py-2 text-xs font-semibold hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConsentNotice(false);
                  requestCookieConsent();
                }}
                className="rounded bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
              >
                OK
              </button>
            </div>
          </section>
        </div>
      )}

      <footer className="flex min-h-10 shrink-0 items-center justify-between gap-3 border-t border-black bg-[#292929] px-3">
        {message ? (
          <p role="status" className="truncate text-[10px] text-zinc-300">{message}</p>
        ) : (
          <p className="truncate text-[10px] text-zinc-500">
            The effect is saved as a draft; physical LEDs are not connected yet.
          </p>
        )}
        {uses > 0 ? (
          <button
            type="button"
            disabled={busy || !name.trim() || frames.length < 2}
            onClick={() => void applyEffect()}
            className="shrink-0 rounded bg-violet-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {busy ? "Saving…" : "Apply"}
          </button>
        ) : (
          <a href="/shop" className="shrink-0 rounded bg-violet-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-violet-500">
            Buy more
          </a>
        )}
      </footer>
    </section>
  );
}
