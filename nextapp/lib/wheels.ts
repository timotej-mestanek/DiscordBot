import { randomInt } from "node:crypto";

export type WheelKind = "main" | "vip" | "game";
export type WheelPointMode = "channel_points" | "n4jt_points";

export function isWheelTestMode(): boolean {
  return process.env.WHEEL_MODE === "test";
}

export type WheelSlice = {
  id: string;
  label: string;
  probability: number;
  color: string;
  vipTrigger: boolean;
};

export type WheelConfig = {
  title: string;
  enabled: boolean;
  durationMs: number;
  slices: WheelSlice[];
  maxSpins?: number;
  pointMode?: WheelPointMode;
  pointCost?: number;
  channelRewardId?: string;
};

export type WheelProfileData = {
  id: string;
  kind: WheelKind;
  gameId: string | null;
  gameName: string | null;
  spinCount: number;
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

export class WheelSpinLimitReachedError extends Error {
  constructor() {
    super("Wheel spin limit reached.");
    this.name = "WheelSpinLimitReachedError";
  }
}

export class WheelItemsExhaustedError extends Error {
  constructor() {
    super("All wheel items have already been selected since the last reset.");
    this.name = "WheelItemsExhaustedError";
  }
}

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

  let totalProbability = 0;
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
      typeof slice.probability !== "number" ||
      !Number.isFinite(slice.probability) ||
      slice.probability < 0.01 ||
      slice.probability > 100 ||
      Math.abs(slice.probability * 100 - Math.round(slice.probability * 100)) > 1e-7 ||
      typeof slice.color !== "string" ||
      !/^#[0-9a-fA-F]{6}$/.test(slice.color) ||
      typeof slice.vipTrigger !== "boolean" ||
      (kind !== "main" && slice.vipTrigger)
    ) {
      return false;
    }
    ids.add(slice.id);
    totalProbability += Math.round(slice.probability * 100);
    if (slice.vipTrigger) vipTriggers += 1;
  }
  if ((config.slices.length > 0 && totalProbability !== 10_000) || vipTriggers > 1) {
    return false;
  }

  if (kind === "game") {
    return (
      (config.pointMode === "channel_points" ||
        config.pointMode === "n4jt_points") &&
      typeof config.maxSpins === "number" &&
      Number.isSafeInteger(config.maxSpins) &&
      config.maxSpins >= 1 &&
      config.maxSpins <= 100 &&
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
    config.maxSpins === undefined &&
    config.pointMode === undefined &&
    config.pointCost === undefined &&
    config.channelRewardId === undefined
  );
}

export function selectWeightedSlice(
  slices: WheelSlice[],
  excludedIds: ReadonlySet<string> = new Set(),
): WheelSlice {
  const availableSlices = slices.filter((slice) => !excludedIds.has(slice.id));
  if (availableSlices.length === 0) throw new WheelItemsExhaustedError();
  const totalProbability = availableSlices.reduce(
    (total, slice) => total + Math.round(slice.probability * 100),
    0,
  );
  let remaining = randomInt(totalProbability);
  for (const slice of availableSlices) {
    const sliceProbability = Math.round(slice.probability * 100);
    if (remaining < sliceProbability) return slice;
    remaining -= sliceProbability;
  }
  throw new Error("Wheel slice selection failed.");
}

export function makeSpinSegment(
  profile: WheelProfileData,
  selectedSlice: WheelSlice,
  slices = profile.config.slices,
): WheelSpinSegment {
  return {
    profileId: profile.id,
    title: profile.config.title,
    durationMs: profile.config.durationMs,
    slices,
    selectedSliceId: selectedSlice.id,
    selectedLabel: selectedSlice.label,
  };
}
