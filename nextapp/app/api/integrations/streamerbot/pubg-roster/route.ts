import { Prisma } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import { prisma } from "@/lib/prisma";

const DEFAULT_PLAYER_NAME = "N4JTIK";
const MAX_ROSTER_SIZE = 4;

type RosterRequest =
  | { action: "newplayer"; slot: number; nickname: string }
  | { action: "deleteplayer"; slot: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidNickname(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= 32 &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function parseRequest(value: unknown): RosterRequest | null {
  if (
    !isRecord(value) ||
    typeof value.slot !== "number" ||
    !Number.isSafeInteger(value.slot)
  ) {
    return null;
  }

  const slot = value.slot;
  if (slot < 1 || slot > MAX_ROSTER_SIZE) return null;

  if (
    value.action === "newplayer" &&
    isValidNickname(value.nickname)
  ) {
    return { action: value.action, slot, nickname: value.nickname };
  }
  if (value.action === "deleteplayer") {
    return { action: value.action, slot };
  }
  return null;
}

export async function POST(request: Request) {
  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    console.error("Streamer.bot PUBG roster integration is not configured.");
    return NextResponse.json(
      { error: "Integrace není nakonfigurovaná." },
      { status: 503 },
    );
  }
  if (authorization === "unauthorized") {
    return NextResponse.json({ error: "Neplatná autorizace." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data požadavku." }, { status: 400 });
  }
  const input = parseRequest(body);
  if (!input) {
    return NextResponse.json(
      { error: "Neplatná akce, pozice nebo PUBG přezdívka." },
      { status: 400 },
    );
  }
  if (input.action === "deleteplayer" && input.slot === 1) {
    return NextResponse.json(
      { error: "Hlavního hráče (slot 1) nelze odstranit." },
      { status: 400 },
    );
  }

  const requestId = randomUUID();
  try {
    const result = await prisma.$transaction(async (transaction) => {
      const settings = await transaction.streamOverlayIntegration.findUnique({
        where: { id: "streamer" },
        select: { pubg_player_name: true, pubg_teammates: true },
      });
      const playerName = settings?.pubg_player_name ?? DEFAULT_PLAYER_NAME;
      const teammates = Array.isArray(settings?.pubg_teammates)
        ? settings.pubg_teammates.filter(
            (name): name is string => typeof name === "string",
          )
        : [];
      const roster = [playerName, ...teammates];
      const previousRoster = [...roster];

      if (input.action === "newplayer") {
        if (input.slot > roster.length + 1) {
          throw new Error(
            `Pozice ${input.slot} je mimo pořadí. Další volná pozice je ${roster.length + 1}.`,
          );
        }
        if (input.slot <= roster.length) {
          roster[input.slot - 1] = input.nickname;
        } else {
          roster.push(input.nickname);
        }
      } else {
        if (input.slot > roster.length) {
          throw new Error(`Hráč na pozici ${input.slot} neexistuje.`);
        }
        roster.splice(input.slot - 1, 1);
      }
      const normalizedNames = roster.map((name) => name.toLocaleLowerCase("en-US"));
      if (new Set(normalizedNames).size !== normalizedNames.length) {
        throw new Error("Stejná PUBG přezdívka už v sestavě je.");
      }

      const [updated] = await Promise.all([
        transaction.streamOverlayIntegration.upsert({
          where: { id: "streamer" },
          create: {
            id: "streamer",
            pubg_player_name: roster[0],
            pubg_teammates: roster.slice(1),
          },
          update: {
            pubg_player_name: roster[0],
            pubg_teammates: roster.slice(1),
          },
          select: { pubg_player_name: true, pubg_teammates: true },
        }),
        transaction.adminAuditLog.create({
          data: {
            action: "gamestats.pubg_roster_updated",
            details: {
              source: "streamerbot",
              operation: input.action,
              slot: input.slot,
              ...(input.action === "newplayer" ? { nickname: input.nickname } : {}),
              previousRoster,
              roster,
            },
          },
        }),
        transaction.streamerBotIntegrationLog.create({
          data: {
            request_id: requestId,
            operation: `pubg-roster.${input.action}`,
            success: true,
            status_code: 200,
            request_details: JSON.stringify(input),
            response_details: JSON.stringify({ ok: true, roster }),
          },
        }),
      ]);

      return {
        roster: [
          updated.pubg_player_name,
          ...(Array.isArray(updated.pubg_teammates)
            ? updated.pubg_teammates.filter(
                (name): name is string => typeof name === "string",
              )
            : []),
        ],
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    return NextResponse.json({
      ok: true,
      action: input.action,
      slot: input.slot,
      roster: result.roster,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("Pozice ")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.startsWith("Hráč na pozici ")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith("Stejná PUBG přezdívka")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "PUBG sestava se mezitím změnila. Zkus příkaz znovu." },
        { status: 409 },
      );
    }
    console.error("Streamer.bot PUBG roster update failed:", error);
    return NextResponse.json(
      { error: "PUBG sestavu se nepodařilo aktualizovat." },
      { status: 500 },
    );
  }
}
