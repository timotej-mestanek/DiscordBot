import { NextResponse } from "next/server";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";
import { prisma } from "@/lib/prisma";

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

export async function GET() {
  try {
    const live = await getTwitchLiveStatus();
    if (!live.isLive || !live.gameId) {
      return NextResponse.json(
        { profileId: null, gameName: null, spins: null },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const profileId = `game:${live.gameId}`;
    const profile = await prisma.wheelProfile.findUnique({
      where: { id: profileId },
      select: { reset_at: true },
    });
    if (!profile) {
      return NextResponse.json(
        { profileId, gameName: live.gameName, spins: [] },
        { headers: { "Cache-Control": "no-store" } },
      );
    }

    const spins = await prisma.wheelSpin.findMany({
      where: {
        profile_id: profileId,
        ...(profile.reset_at ? { created_at: { gt: profile.reset_at } } : {}),
      },
      orderBy: [{ created_at: "asc" }, { id: "asc" }],
      select: {
        id: true,
        display_name: true,
        game_name: true,
        sequence: true,
        created_at: true,
      },
    });
    const cards = spins.map((spin) => {
      const result = getResult(spin.sequence);
      if (!result) {
        throw new Error(`Wheel spin ${spin.id} does not contain a valid result and duration.`);
      }
      return {
        id: spin.id,
        displayName: spin.display_name,
        gameName: spin.game_name ?? live.gameName ?? "Herná hra",
        result: result.label,
        rarity: result.weight / result.totalWeight,
        createdAt: spin.created_at,
        revealAt: new Date(spin.created_at.getTime() + result.durationMs + 500),
      };
    });

    return NextResponse.json(
      { profileId, gameName: live.gameName, spins: cards },
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
