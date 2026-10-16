import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import { prisma } from "@/lib/prisma";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function persistLog(input: {
  requestId: string;
  success: boolean;
  statusCode: number;
  requestDetails: string | null;
  responseDetails: string;
}) {
  try {
    await prisma.streamerBotIntegrationLog.create({
      data: {
        request_id: input.requestId,
        operation: "wheel.game_limit.reset",
        success: input.success,
        status_code: input.statusCode,
        request_details: input.requestDetails,
        response_details: input.responseDetails,
      },
    });
  } catch (error) {
    console.error("Failed to persist Streamer.bot wheel reset log:", input.requestId, error);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let requestDetails: string | null = null;
  const respond = async (
    status: number,
    body: Record<string, unknown>,
    success = false,
  ) => {
    const responseDetails = JSON.stringify(body);
    await persistLog({
      requestId,
      success,
      statusCode: status,
      requestDetails,
      responseDetails,
    });
    if (success) {
      console.log("Streamer.bot wheel limit reset succeeded:", requestId, responseDetails);
    } else {
      console.error("Streamer.bot wheel limit reset failed:", requestId, status, responseDetails);
    }
    return NextResponse.json(body, {
      status,
      headers: { "Cache-Control": "no-store" },
    });
  };

  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    return respond(503, { error: "Streamer.bot integrácia nie je nakonfigurovaná." });
  }
  if (authorization === "unauthorized") {
    return respond(401, { error: "Neplatná autorizácia." });
  }

  let body: unknown;
  try {
    body = await request.json();
    if (isRecord(body)) {
      requestDetails = JSON.stringify({
        eventId: body.eventId,
        userId: body.userId,
        displayName: body.displayName,
        isModerator: body.isModerator,
        isBroadcaster: body.isBroadcaster,
      }).slice(0, 10_000);
    } else {
      requestDetails = JSON.stringify(body).slice(0, 10_000);
    }
  } catch {
    return respond(400, { error: "Neplatné dáta požiadavky." });
  }
  if (!isRecord(body)) {
    return respond(400, { error: "Neplatné dáta resetu." });
  }
  if (
    typeof body.eventId !== "string" ||
    body.eventId.trim().length === 0 ||
    body.eventId.length > 180 ||
    typeof body.userId !== "string" ||
    !/^\d{1,32}$/.test(body.userId) ||
    typeof body.displayName !== "string" ||
    body.displayName.trim().length === 0 ||
    body.displayName.length > 80
  ) {
    return respond(400, { error: "Neplatné údaje moderátora." });
  }
  if (body.isModerator !== true && body.isBroadcaster !== true) {
    return respond(403, { error: "Reset môže vykonať iba moderátor alebo streamer." });
  }
  const eventId = body.eventId;
  const userId = body.userId;
  const displayName = body.displayName.trim();

  try {
    const liveStatus = await getTwitchLiveStatus();
    if (!liveStatus.isLive || !liveStatus.gameId || !liveStatus.gameName) {
      return respond(409, { error: "Stream je offline alebo nemá aktívnu Twitch hru." });
    }
    const profileId = `game:${liveStatus.gameId}`;
    const reset = await prisma.$transaction(async (transaction) => {
      const profile = await transaction.wheelProfile.findUnique({
        where: { id: profileId },
        select: { id: true, game_name: true, spin_count: true },
      });
      if (!profile) return null;
      await transaction.wheelProfile.update({
        where: { id: profile.id },
        data: { spin_count: 0 },
      });
      await transaction.adminAuditLog.create({
        data: {
          action: "wheel.game_limit_reset",
          details: {
            profileId,
            gameName: profile.game_name,
            previousSpinCount: profile.spin_count,
            resetBy: displayName,
            twitchUserId: userId,
            sourceEventId: eventId,
          },
        },
      });
      return profile;
    });
    if (!reset) {
      return respond(404, { error: `Profil herného kolesa pre ${liveStatus.gameName} sa nenašiel.` });
    }
    return respond(
      200,
      {
        ok: true,
        gameName: reset.game_name,
        previousSpinCount: reset.spin_count,
        spinCount: 0,
      },
      true,
    );
  } catch (error) {
    console.error("Streamer.bot wheel limit reset failed:", requestId, error);
    return respond(500, { error: "Limit herného kolesa sa nepodarilo resetovať." });
  }
}
