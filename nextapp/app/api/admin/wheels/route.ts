import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import {
  defaultWheelConfig,
  isWheelConfig,
  type WheelKind,
  type WheelProfileData,
} from "@/lib/wheels";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";
import { publishWheelRealtimeEvent } from "@/lib/wheel-realtime";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWheelKind(value: unknown): value is WheelKind {
  return value === "main" || value === "vip" || value === "game";
}

function parseProfile(value: unknown): WheelProfileData | null {
  if (!isRecord(value) || !isWheelKind(value.kind)) return null;
  const kind = value.kind;
  const isGame = kind === "game";
  if (
    typeof value.id !== "string" ||
    (isGame
      ? !/^game:\d{1,32}$/.test(value.id) ||
        typeof value.gameId !== "string" ||
        !/^\d{1,32}$/.test(value.gameId) ||
        value.id !== `game:${value.gameId}` ||
        typeof value.gameName !== "string" ||
        value.gameName.trim().length === 0 ||
        value.gameName.length > 100
      : value.id !== kind || value.gameId !== null || value.gameName !== null) ||
    !isWheelConfig(value.config, kind)
  ) {
    return null;
  }

  return {
    id: value.id,
    kind,
    gameId: isGame ? (value.gameId as string) : null,
    gameName: isGame ? (value.gameName as string).trim() : null,
    spinCount: 0,
    config: value.config,
  };
}

function profileFromDatabase(profile: {
  id: string;
  kind: string;
  game_id: string | null;
  game_name: string | null;
  spin_count: number;
  config: unknown;
}): WheelProfileData {
  if (
    !isWheelKind(profile.kind) ||
    !isWheelConfig(profile.config, profile.kind) ||
    (profile.kind === "game" &&
      (!profile.game_id ||
        !profile.game_name ||
        profile.id !== `game:${profile.game_id}`)) ||
    (profile.kind !== "game" && profile.id !== profile.kind)
  ) {
    throw new Error(`Invalid persisted wheel profile: ${profile.id}`);
  }
  return {
    id: profile.id,
    kind: profile.kind,
    gameId: profile.game_id,
    gameName: profile.game_name,
    spinCount: profile.spin_count,
    config: profile.config,
  };
}

async function requireAdmin() {
  const account = await getCurrentAccount();
  if (!account) {
    return {
      admin: null,
      response: NextResponse.json({ error: "Sign in to continue." }, { status: 401 }),
    };
  }
  if (account.role !== "admin") {
    return {
      admin: null,
      response: NextResponse.json({ error: "Access denied." }, { status: 403 }),
    };
  }
  return { admin: account, response: null };
}

export async function GET() {
  const { response } = await requireAdmin();
  if (response) return response;

  try {
    const [storedProfiles, liveStatus] = await Promise.all([
      prisma.wheelProfile.findMany({ orderBy: [{ kind: "asc" }, { game_name: "asc" }] }),
      getTwitchLiveStatus().catch((error: unknown) => {
        console.error("Current Twitch game lookup for wheel settings failed:", error);
        return null;
      }),
    ]);
    const profiles = storedProfiles.map(profileFromDatabase);
    for (const kind of ["main", "vip"] as const) {
      if (!profiles.some((profile) => profile.id === kind)) {
        profiles.push({
          id: kind,
          kind,
          gameId: null,
          gameName: null,
          spinCount: 0,
          config: defaultWheelConfig(
            kind === "main" ? "Prize wheel" : "VIP prize wheel",
          ),
        });
      }
    }
    return NextResponse.json({
      profiles,
      liveGame:
        liveStatus?.isLive && liveStatus.gameId && liveStatus.gameName
          ? { id: liveStatus.gameId, name: liveStatus.gameName }
          : null,
      liveGameUnavailable: liveStatus === null,
    });
  } catch (error) {
    console.error("Wheel admin configuration lookup failed:", error);
    return NextResponse.json(
      { error: "Could not load the wheel configuration." },
      { status: 500 },
    );
  }
}

export async function PUT(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }
  if (!isRecord(body) || !Array.isArray(body.profiles) || body.profiles.length > 100) {
    return NextResponse.json({ error: "Invalid wheel configuration." }, { status: 400 });
  }

  const profiles = body.profiles.map(parseProfile);
  if (
    profiles.some((profile) => profile === null) ||
    new Set(profiles.map((profile) => profile?.id)).size !== profiles.length ||
    !profiles.some((profile) => profile?.id === "main") ||
    !profiles.some((profile) => profile?.id === "vip") ||
    new Set(profiles.filter((profile) => profile?.kind === "game").map((profile) => profile?.gameId)).size !==
      profiles.filter((profile) => profile?.kind === "game").length
  ) {
    return NextResponse.json(
      { error: "Check the names, Twitch game IDs, and outcomes for all wheels." },
      { status: 400 },
    );
  }

  const validProfiles = profiles as WheelProfileData[];
  const mainProfile = validProfiles.find((profile) => profile.id === "main");
  const vipProfile = validProfiles.find((profile) => profile.id === "vip");
  if (
    mainProfile?.config.enabled &&
    mainProfile.config.slices.some((slice) => slice.vipTrigger) &&
    !vipProfile?.config.enabled
  ) {
    return NextResponse.json(
      { error: "The VIP wheel must be enabled when the main wheel has a VIP outcome." },
      { status: 400 },
    );
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const gameIds = validProfiles
        .filter((profile) => profile.kind === "game")
        .map((profile) => profile.id);
      await transaction.wheelProfile.deleteMany({
        where: { kind: "game", id: { notIn: gameIds } },
      });
      for (const profile of validProfiles) {
        await transaction.wheelProfile.upsert({
          where: { id: profile.id },
          create: {
            id: profile.id,
            kind: profile.kind,
            game_id: profile.gameId,
            game_name: profile.gameName,
            config: profile.config,
          },
          update: {
            kind: profile.kind,
            game_id: profile.gameId,
            game_name: profile.gameName,
            config: profile.config,
          },
        });
      }
      await transaction.adminAuditLog.create({
        data: {
          actor_account_id: admin.id,
          action: "wheel.configuration_updated",
          details: {
            profiles: validProfiles.map((profile) => ({
              id: profile.id,
              kind: profile.kind,
              gameName: profile.gameName,
              enabled: profile.config.enabled,
              sliceCount: profile.config.slices.length,
            })),
          },
        },
      });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Wheel admin configuration save failed:", error);
    return NextResponse.json(
      { error: "Could not save the wheel configuration." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const { admin, response } = await requireAdmin();
  if (response || !admin) return response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    body.action !== "reset-game-limit" ||
    typeof body.gameId !== "string" ||
    !/^\d{1,32}$/.test(body.gameId)
  ) {
    return NextResponse.json({ error: "Invalid game wheel reset request." }, { status: 400 });
  }

  const profileId = `game:${body.gameId}`;
  try {
    const resetAt = new Date();
    const reset = await prisma.$transaction(async (transaction) => {
      const profile = await transaction.wheelProfile.findUnique({
        where: { id: profileId },
        select: { id: true, game_name: true, spin_count: true },
      });
      if (!profile) return null;
      await transaction.wheelProfile.update({
        where: { id: profile.id },
        data: { spin_count: 0, reset_at: resetAt },
      });
      await transaction.adminAuditLog.create({
        data: {
          actor_account_id: admin.id,
          action: "wheel.game_limit_reset",
          details: {
            profileId,
            gameName: profile.game_name,
            previousSpinCount: profile.spin_count,
          },
        },
      });
      return profile;
    });
    if (!reset) {
      return NextResponse.json({ error: "Game profile not found." }, { status: 404 });
    }
    publishWheelRealtimeEvent({
      type: "reset",
      profileId,
      resetAt: resetAt.toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Wheel game limit reset failed:", error);
    return NextResponse.json(
      { error: "Could not reset the game wheel limit." },
      { status: 500 },
    );
  }
}
