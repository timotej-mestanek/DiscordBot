"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  WheelHistoryCard,
  WheelRealtimeEvent,
  WheelRealtimeSpin,
} from "@/lib/wheel-realtime";
import TaskCardGraphic, { type TaskCardType } from "./TaskCardGraphic";
import useWheelRealtime from "./useWheelRealtime";

type ProfileHistory = {
  gameName: string;
  maxSpins: number;
  resetAt: string | null;
  spins: WheelHistoryCard[];
};

function getSliceProbability(slice: unknown): number | null {
  if (typeof slice !== "object" || slice === null) return null;
  if ("probability" in slice && typeof slice.probability === "number") {
    return slice.probability;
  }
  if ("weight" in slice && typeof slice.weight === "number") {
    return slice.weight;
  }
  return null;
}

function historyCardFromSpin(spin: WheelRealtimeSpin): WheelHistoryCard | null {
  if (!Array.isArray(spin.sequence)) return null;
  const segment = spin.sequence[0];
  if (
    typeof segment !== "object" ||
    segment === null ||
    !("selectedLabel" in segment) ||
    typeof segment.selectedLabel !== "string" ||
    !("selectedSliceId" in segment) ||
    typeof segment.selectedSliceId !== "string" ||
    !("durationMs" in segment) ||
    typeof segment.durationMs !== "number" ||
    !("slices" in segment) ||
    !Array.isArray(segment.slices)
  ) {
    return null;
  }
  const slices: unknown[] = segment.slices;
  const selected = slices.find(
    (slice: unknown) =>
      typeof slice === "object" &&
      slice !== null &&
      "id" in slice &&
      slice.id === segment.selectedSliceId &&
      getSliceProbability(slice) !== null,
  );
  const totalProbability = slices.reduce<number>(
    (total: number, slice: unknown) => total + (getSliceProbability(slice) ?? 0),
    0,
  );
  const selectedProbability = getSliceProbability(selected);
  if (selectedProbability === null || totalProbability <= 0) {
    return null;
  }
  return {
    id: spin.id,
    displayName: spin.display_name,
    gameName: spin.game_name ?? "Game",
    result: segment.selectedLabel,
    rarity: selectedProbability / totalProbability,
    createdAt: spin.created_at,
    revealAt: new Date(Date.parse(spin.created_at) + segment.durationMs + 500).toISOString(),
  };
}

function taskTypeForSpin(index: number, maxSpins: number): TaskCardType {
  if (index === 0) return "first";
  if (index === maxSpins - 1) return "last";
  return "normal";
}

export default function WheelSpinsSinceResetOverlay() {
  const [profiles, setProfiles] = useState<Record<string, ProfileHistory>>({});
  const profilesRef = useRef(profiles);
  const timers = useRef(new Map<string, { profileId: string; timer: number }>());
  const seenSpinIds = useRef(new Set<string>());

  useEffect(() => {
    profilesRef.current = profiles;
  }, [profiles]);

  const handleRealtimeEvent = useCallback((event: WheelRealtimeEvent) => {
    if (event.type === "snapshot") {
      for (const { timer } of timers.current.values()) window.clearTimeout(timer);
      timers.current.clear();
      seenSpinIds.current = new Set(event.profiles.flatMap((profile) =>
        profile.spins.map((spin) => spin.id),
      ));
      const now = Date.now();
      const nextProfiles: Record<string, ProfileHistory> = {};
      for (const profile of event.profiles) {
        const revealed: WheelHistoryCard[] = [];
        for (const spin of profile.spins) {
          const delay = Date.parse(spin.revealAt) - now;
          if (delay <= 0) {
            revealed.push(spin);
          } else {
            const timer = window.setTimeout(() => {
              timers.current.delete(spin.id);
              setProfiles((current) => {
                const existing = current[profile.profileId];
                if (
                  !existing ||
                  (existing.resetAt && Date.parse(spin.createdAt) <= Date.parse(existing.resetAt))
                ) {
                  return current;
                }
                return {
                  ...current,
                  [profile.profileId]: {
                    ...existing,
                    spins: existing.spins.some((item) => item.id === spin.id)
                      ? existing.spins
                      : [...existing.spins, spin],
                  },
                };
              });
            }, delay);
            timers.current.set(spin.id, { profileId: profile.profileId, timer });
          }
        }
        nextProfiles[profile.profileId] = {
          gameName: profile.gameName,
          maxSpins: profile.maxSpins,
          resetAt: profile.resetAt,
          spins: revealed,
        };
      }
      setProfiles(nextProfiles);
      return;
    }
    if (event.type === "reset") {
      const currentResetAt = profilesRef.current[event.profileId]?.resetAt;
      if (
        currentResetAt &&
        Date.parse(currentResetAt) >= Date.parse(event.resetAt)
      ) {
        return;
      }
      for (const [id, pending] of timers.current) {
        if (pending.profileId === event.profileId) {
          window.clearTimeout(pending.timer);
          timers.current.delete(id);
        }
      }
      setProfiles((current) => {
        const profile = current[event.profileId];
        return {
          ...current,
          [event.profileId]: {
            gameName: profile?.gameName ?? "Game",
            maxSpins: profile?.maxSpins ?? 2,
            resetAt: event.resetAt,
            spins: [],
          },
        };
      });
      return;
    }

    if (!event.spin.profile_id.startsWith("game:")) return;
    if (seenSpinIds.current.has(event.spin.id)) return;
    const spin = historyCardFromSpin(event.spin);
    if (!spin) {
      console.error("Wheel history WebSocket received an invalid game spin.");
      return;
    }
    seenSpinIds.current.add(spin.id);
    const delay = Math.max(0, Date.parse(spin.revealAt) - Date.now());
    const reveal = () => {
      timers.current.delete(spin.id);
      setProfiles((current) => {
        const existing = current[event.spin.profile_id];
        if (
          existing?.resetAt &&
          Date.parse(spin.createdAt) <= Date.parse(existing.resetAt)
        ) {
          return current;
        }
        return {
          ...current,
          [event.spin.profile_id]: {
            gameName: event.spin.game_name ?? existing?.gameName ?? "Game",
            maxSpins: existing?.maxSpins ?? 2,
            resetAt: existing?.resetAt ?? null,
            spins: existing?.spins.some((item) => item.id === spin.id)
              ? existing.spins
              : [...(existing?.spins ?? []), spin],
          },
        };
      });
    };
    if (delay === 0) {
      reveal();
    } else {
      const timer = window.setTimeout(reveal, delay);
      timers.current.set(spin.id, { profileId: event.spin.profile_id, timer });
    }
  }, []);
  useWheelRealtime(handleRealtimeEvent);

  const spins = Object.values(profiles)
    .flatMap((profile) => {
      const orderedSpins = [...profile.spins].sort((left, right) =>
        left.createdAt.localeCompare(right.createdAt),
      );
      return orderedSpins.map((spin, index) => ({
        ...spin,
        taskType: taskTypeForSpin(index, profile.maxSpins),
      }));
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const rarityColor = (rarity: number) =>
    rarity <= 0.05
      ? "#facc15"
      : rarity <= 0.1
        ? "#ef4444"
        : rarity <= 0.2
          ? "#f472b6"
          : "#22c55e";

  return (
    <main className="wheel-history-canvas pointer-events-none fixed inset-0 flex items-end justify-center overflow-hidden p-6 text-white sm:p-10">
      {spins.length > 0 && (
        <section
          aria-label="Game wheel results since the last reset"
          className="mb-2 flex max-h-[min(70vh,48rem)] w-[min(34rem,calc(100vw-2rem))] flex-col gap-3 overflow-y-hidden"
        >
          {[...spins].reverse().map((spin) => (
            <article
              key={spin.id}
              aria-live="polite"
              className="wheel-result-card-visible relative isolate flex min-h-28 items-center justify-between gap-4  rounded-xl px-5 py-3 text-left"
            >
              <TaskCardGraphic
              type={spin.taskType}
              color={rarityColor(spin.rarity)}
              />
              <div className="relative z-10 min-w-0">
                <h2 className="break-words text-2xl font-black leading-tight text-white sm:text-3xl">
                  {spin.result}
                </h2>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  );
}
