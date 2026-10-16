import { NextResponse } from "next/server";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";
import { prisma } from "@/lib/prisma";
import { isWheelTestMode } from "@/lib/wheels";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getResult(
  sequence: unknown,
): { label: string; durationMs: number; weight: number; totalWeight: number } | null {
  if (!Array.isArray(sequence)) return null;
  const segment = sequence[0];
  if (
    !isRecord(segment) ||
    typeof segment.selectedLabel !== "string" ||
    typeof segment.selectedSliceId !== "string" ||
    typeof segment.durationMs !== "number" ||
    !Number.isFinite(segment.durationMs) ||
    !Array.isArray(segment.slices)
  ) {
    return null;
  }
  const selectedSlice = segment.slices.find(
    (slice) =>
      isRecord(slice) &&
      slice.id === segment.selectedSliceId &&
      typeof slice.weight === "number",
  );
  const totalWeight = segment.slices.reduce(
    (total, slice) =>
      isRecord(slice) && typeof slice.weight === "number" ? total + slice.weight : total,
    0,
  );
  if (
    !isRecord(selectedSlice) ||
    typeof selectedSlice.weight !== "number" ||
    totalWeight <= 0
  ) {
    return null;
  }
  return {
    label: segment.selectedLabel,
    durationMs: segment.durationMs,
    weight: selectedSlice.weight,
    totalWeight,
  };
}

type SpinHistoryCard = {
  id: string;
  displayName: string;
  gameName: string;
  result: string;
  rarity: number;
  createdAt: Date;
  revealAt: Date;
};

export async function GET() {
  try {
    const testMode = isWheelTestMode();
    const live = testMode ? null : await getTwitchLiveStatus();
    if (!testMode && (!live?.isLive || !live.gameId)) {
      return NextResponse.json(
        { profiles: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const profiles = testMode
      ? await prisma.wheelProfile.findMany({
          where: { kind: "game" },
          select: { id: true, game_name: true, reset_at: true },
        })
      : await prisma.wheelProfile.findMany({
          where: { id: `game:${live?.gameId}` },
          select: { id: true, game_name: true, reset_at: true },
        });
    const spinsByProfile = new Map<string, SpinHistoryCard[]>(
      profiles.map((profile) => [profile.id, []]),
    );
    const spins = profiles.length
      ? await prisma.wheelSpin.findMany({
          where: {
            OR: profiles.map((profile) => ({
              profile_id: profile.id,
              ...(profile.reset_at ? { created_at: { gt: profile.reset_at } } : {}),
            })),
          },
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
          select: {
            id: true,
            profile_id: true,
            display_name: true,
            game_name: true,
            sequence: true,
            created_at: true,
          },
        })
      : [];

    const gameNames = new Map(
      profiles.map((profile) => [profile.id, profile.game_name ?? "Herná hra"]),
    );
    for (const spin of spins) {
      const result = getResult(spin.sequence);
      if (!result) {
        throw new Error(`Wheel spin ${spin.id} does not contain a valid result and duration.`);
      }
      const profileSpins = spinsByProfile.get(spin.profile_id);
      profileSpins?.push({
        id: spin.id,
        displayName: spin.display_name,
        gameName: spin.game_name ?? gameNames.get(spin.profile_id) ?? "Herná hra",
        result: result.label,
        rarity: result.weight / result.totalWeight,
        createdAt: spin.created_at,
        revealAt: new Date(spin.created_at.getTime() + result.durationMs + 500),
      });
    }

    const historyProfiles = profiles.map((profile) => ({
      profileId: profile.id,
      gameName: profile.game_name ?? "Herná hra",
      spins: spinsByProfile.get(profile.id) ?? [],
    }));

    return NextResponse.json(
      { profiles: historyProfiles },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Wheel spins since reset lookup failed:", error);
    return NextResponse.json(
      { error: "Históriu herného kolesa sa nepodarilo načítať." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
