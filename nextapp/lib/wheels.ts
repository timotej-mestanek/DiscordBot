import { randomInt } from "node:crypto";

export type WheelKind = "main" | "vip" | "game";
export type WheelPointMode = "channel_points" | "n4jt_points";

export type WheelSlice = {
  id: string;
  label: string;
  weight: number;
  color: string;
  vipTrigger: boolean;
};

export type WheelConfig = {
  title: string;
  enabled: boolean;
  durationMs: number;
  slices: WheelSlice[];
  pointMode?: WheelPointMode;
  pointCost?: number;
  channelRewardId?: string;
};

export type WheelProfileData = {
  id: string;
  kind: WheelKind;
  gameId: string | null;
  gameName: string | null;
  config: WheelConfig;
};

export type WheelSpinSegment = {
  profileId: string;
  title: string;
  durationMs: number;
  slices: WheelSlice[];
  selectedSliceId: string;
  selectedLabel: string;
};

export function defaultWheelConfig(title: string): WheelConfig {
  return { title, enabled: false, durationMs: 8_000, slices: [] };
}

export function isWheelConfig(value: unknown, kind: WheelKind): value is WheelConfig {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const config = value as Record<string, unknown>;
  if (
    typeof config.title !== "string" ||
    config.title.trim().length === 0 ||
    config.title.length > 80 ||
    typeof config.enabled !== "boolean" ||
    typeof config.durationMs !== "number" ||
    !Number.isInteger(config.durationMs) ||
    config.durationMs < 3_000 ||
    config.durationMs > 30_000 ||
    !Array.isArray(config.slices) ||
    (config.enabled && config.slices.length < 2) ||
    config.slices.length > 24
  ) {
    return false;
  }

  let totalWeight = 0;
  let vipTriggers = 0;
  const ids = new Set<string>();
  for (const slice of config.slices) {
    if (
      typeof slice !== "object" ||
      slice === null ||
      Array.isArray(slice) ||
      typeof slice.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,64}$/.test(slice.id) ||
      ids.has(slice.id) ||
      typeof slice.label !== "string" ||
      slice.label.trim().length === 0 ||
      slice.label.length > 80 ||
      typeof slice.weight !== "number" ||
      !Number.isInteger(slice.weight) ||
      slice.weight < 1 ||
      slice.weight > 10_000 ||
      typeof slice.color !== "string" ||
      !/^#[0-9a-fA-F]{6}$/.test(slice.color) ||
      typeof slice.vipTrigger !== "boolean" ||
      (kind !== "main" && slice.vipTrigger)
    ) {
      return false;
    }
    ids.add(slice.id);
    totalWeight += slice.weight;
    if (slice.vipTrigger) vipTriggers += 1;
  }
  if (totalWeight > 100_000 || vipTriggers > 1) return false;

  if (kind === "game") {
    return (
      (config.pointMode === "channel_points" ||
        config.pointMode === "n4jt_points") &&
      typeof config.pointCost === "number" &&
      Number.isSafeInteger(config.pointCost) &&
      config.pointCost > 0 &&
      config.pointCost <= 1_000_000 &&
      (config.pointMode !== "channel_points" ||
        (typeof config.channelRewardId === "string" &&
          config.channelRewardId.length > 0 &&
          config.channelRewardId.length <= 100))
    );
  }

  return (
    config.pointMode === undefined &&
    config.pointCost === undefined &&
    config.channelRewardId === undefined
  );
}

export function selectWeightedSlice(slices: WheelSlice[]): WheelSlice {
  const totalWeight = slices.reduce((total, slice) => total + slice.weight, 0);
  let remaining = randomInt(totalWeight);
  for (const slice of slices) {
    if (remaining < slice.weight) return slice;
    remaining -= slice.weight;
  }
  throw new Error("Wheel slice selection failed.");
}

export function makeSpinSegment(
  profile: WheelProfileData,
  selectedSlice: WheelSlice,
): WheelSpinSegment {
  return {
    profileId: profile.id,
    title: profile.config.title,
    durationMs: profile.config.durationMs,
    slices: profile.config.slices,
    selectedSliceId: selectedSlice.id,
    selectedLabel: selectedSlice.label,
  };
}
