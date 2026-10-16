import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import { changePointBalance, InsufficientPointsError } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import {
  isWheelConfig,
  makeSpinSegment,
  selectWeightedSlice,
  WheelSpinLimitReachedError,
  type WheelKind,
  type WheelConfig,
  type WheelProfileData,
  type WheelSpinSegment,
} from "@/lib/wheels";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringifyDetails(value: unknown, maxLength: number): string {
  const redact = (item: unknown): unknown => {
    if (Array.isArray(item)) return item.map(redact);
    if (!isRecord(item)) return item;
    return Object.fromEntries(
      Object.entries(item).map(([key, entry]) => [
        key,
        /token|authorization|secret|password/i.test(key) ? "[REDACTED]" : redact(entry),
      ]),
    );
  };
  const serialized = JSON.stringify(redact(value));
  return serialized.length > maxLength
    ? `${serialized.slice(0, maxLength)}…[truncated]`
    : serialized;
}

function isTwitchUserId(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,32}$/.test(value);
}

function isWheelProfile(
  profile: {
    id: string;
    kind: string;
    game_id: string | null;
    game_name: string | null;
    spin_count: number;
    config: unknown;
  } | null,
  kind: WheelKind,
): profile is NonNullable<typeof profile> & {
  kind: WheelKind;
  spin_count: number;
  config: WheelConfig;
} {
  return Boolean(
    profile &&
      profile.kind === kind &&
      isWheelConfig(profile.config, kind) &&
      profile.config.enabled &&
      (kind !== "game" ||
        (profile.game_id &&
          profile.game_name &&
          profile.id === `game:${profile.game_id}`)),
  );
}

function isDuplicate(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function getSpinResult(sequence: unknown, index = 0): string | null {
  if (!Array.isArray(sequence)) return null;
  const segment = sequence[index];
  if (!isRecord(segment) || typeof segment.selectedLabel !== "string") return null;
  return segment.selectedLabel;
}

async function persistLog(input: {
  requestId: string;
  operation: string | null;
  success: boolean;
  statusCode: number;
  requestDetails: string | null;
  responseDetails: string;
}) {
  try {
    await prisma.streamerBotIntegrationLog.create({
      data: {
        request_id: input.requestId,
        operation: input.operation,
        success: input.success,
        status_code: input.statusCode,
        request_details: input.requestDetails,
        response_details: input.responseDetails,
      },
    });
  } catch (error) {
    console.error("Failed to persist Streamer.bot wheel request log:", input.requestId, error);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let requestDetails: string | null = null;
  let operation: string | null = null;
  const respond = async (
    statusCode: number,
    responseBody: Record<string, unknown>,
    success = false,
  ) => {
    const responseDetails = stringifyDetails(responseBody, 4_000);
    await persistLog({
      requestId,
      operation,
      success,
      statusCode,
      requestDetails,
      responseDetails,
    });
    if (success) {
      console.log("Streamer.bot wheel request succeeded:", requestId, operation);
    } else {
      console.error("Streamer.bot wheel request failed:", requestId, operation, statusCode, responseDetails);
    }
    return NextResponse.json(responseBody, {
      status: statusCode,
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
    requestDetails = stringifyDetails(body, 10_000);
  } catch {
    return respond(400, { error: "Neplatné dáta požiadavky." });
  }

  if (
    !isRecord(body) ||
    typeof body.eventId !== "string" ||
    body.eventId.trim().length === 0 ||
    body.eventId.length > 180 ||
    (body.wheel !== "main" && body.wheel !== "game") ||
    !isTwitchUserId(body.userId) ||
    typeof body.displayName !== "string" ||
    body.displayName.trim().length === 0 ||
    body.displayName.length > 80 ||
    (body.wheel === "main" &&
      body.source !== "subscription" &&
      body.source !== "donation") ||
    (body.wheel === "game" &&
      body.source !== "channel_points" &&
      body.source !== "n4jt_points")
  ) {
    return respond(400, { error: "Neplatná udalosť kolesa." });
  }

  operation = `wheel.spin.${body.wheel}`;
  try {
    const existingSpin = await prisma.wheelSpin.findUnique({
      where: { event_id: body.eventId },
    });
    if (existingSpin) {
      return respond(
        200,
        {
          ok: true,
          duplicate: true,
          spinId: existingSpin.id,
          gameName: existingSpin.game_name,
          result: getSpinResult(existingSpin.sequence),
          vipResult: getSpinResult(existingSpin.sequence, 1),
          sequence: existingSpin.sequence,
        },
        true,
      );
    }

    let profileRecord:
      | Awaited<ReturnType<typeof prisma.wheelProfile.findUnique>>
      | null = null;
    let gameName: string | null = null;
    if (body.wheel === "main") {
      profileRecord = await prisma.wheelProfile.findUnique({ where: { id: "main" } });
    } else {
      const liveStatus = await getTwitchLiveStatus();
      if (!liveStatus.isLive || !liveStatus.gameId || !liveStatus.gameName) {
        return respond(409, { error: "Stream je offline alebo nemá aktívnu Twitch hru." });
      }
      gameName = liveStatus.gameName;
      profileRecord = await prisma.wheelProfile.findUnique({
        where: { id: `game:${liveStatus.gameId}` },
      });
    }

    const profileKind = body.wheel as WheelKind;
    if (!isWheelProfile(profileRecord, profileKind)) {
      return respond(
        409,
        {
          error:
            body.wheel === "game"
              ? `Aktívna hra ${gameName ?? ""} nemá zapnutý profil kolesa.`
              : "Hlavné koleso nie je zapnuté alebo nemá platnú konfiguráciu.",
        },
      );
    }
    const profile: WheelProfileData = {
      id: profileRecord.id,
      kind: profileKind,
      gameId: profileRecord.game_id,
      gameName: profileRecord.game_name,
      spinCount: profileRecord.spin_count,
      config: profileRecord.config,
    };

    if (profile.kind === "game") {
      if (body.source !== profile.config.pointMode) {
        return respond(409, { error: "Použitý spôsob platby nezodpovedá nastaveniu herného kolesa." });
      }
      if (
        profile.config.pointMode === "channel_points" &&
        (typeof body.rewardId !== "string" ||
          body.rewardId !== profile.config.channelRewardId)
      ) {
        return respond(403, { error: "Twitch Channel Points reward ID sa nezhoduje." });
      }
    }

    const selected = selectWeightedSlice(profile.config.slices);
    const sequence: WheelSpinSegment[] = [makeSpinSegment(profile, selected)];
    if (profile.kind === "main" && selected.vipTrigger) {
      const vipRecord = await prisma.wheelProfile.findUnique({ where: { id: "vip" } });
      if (!isWheelProfile(vipRecord, "vip")) {
        return respond(409, { error: "VIP segment je zapnutý, ale VIP koleso nemá platnú konfiguráciu." });
      }
      const vipProfile: WheelProfileData = {
        id: vipRecord.id,
        kind: "vip",
        gameId: null,
        gameName: null,
        spinCount: vipRecord.spin_count,
        config: vipRecord.config,
      };
      sequence.push(makeSpinSegment(vipProfile, selectWeightedSlice(vipProfile.config.slices)));
    }

    const eventId = body.eventId;
    const userId = body.userId;
    const displayName = body.displayName.trim();
    const trigger = body.source;
    if (typeof eventId !== "string" || typeof userId !== "string" || typeof trigger !== "string") {
      return respond(400, { error: "Neplatná udalosť kolesa." });
    }
    const pointMode = profile.kind === "game" ? profile.config.pointMode : undefined;
    const pointCost = profile.kind === "game" ? profile.config.pointCost : undefined;
    const spin = await prisma.$transaction(async (transaction) => {
      if (profile.kind === "game") {
        const slot = await transaction.wheelProfile.updateMany({
          where: {
            id: profile.id,
            spin_count: { lt: profile.config.maxSpins },
          },
          data: { spin_count: { increment: 1 } },
        });
        if (slot.count !== 1) throw new WheelSpinLimitReachedError();
      }
      if (pointMode === "n4jt_points" && pointCost !== undefined) {
        await changePointBalance(
          transaction,
          "twitch_custom",
          userId,
          -pointCost,
          "N4JT game wheel spin",
          null,
          `wheel-spin:${eventId}`,
        );
      }
      return transaction.wheelSpin.create({
        data: {
          event_id: eventId,
          viewer_id: userId,
          display_name: displayName,
          profile_id: profile.id,
          trigger,
          game_name: gameName,
          sequence: sequence satisfies Prisma.InputJsonArray as Prisma.InputJsonValue,
        },
      });
    });

    return respond(
      200,
      {
        ok: true,
        duplicate: false,
        spinId: spin.id,
        gameName,
        result: getSpinResult(spin.sequence),
        vipResult: getSpinResult(spin.sequence, 1),
        sequence: spin.sequence,
      },
      true,
    );
  } catch (error) {
    if (error instanceof InsufficientPointsError) {
      return respond(402, { error: "Nemáš dosť N4JT Twitch bodov na otočenie." });
    }
    if (error instanceof WheelSpinLimitReachedError) {
      return respond(429, {
        error: "Limit herného kolesa bol dosiahnutý. Požiadaj moderátora alebo streamera o reset.",
      });
    }
    if (isDuplicate(error)) {
      const duplicate = await prisma.wheelSpin.findUnique({
        where: { event_id: body.eventId as string },
      });
      if (duplicate) {
        return respond(
          200,
          {
            ok: true,
            duplicate: true,
            spinId: duplicate.id,
            gameName: duplicate.game_name,
            result: getSpinResult(duplicate.sequence),
            vipResult: getSpinResult(duplicate.sequence, 1),
            sequence: duplicate.sequence,
          },
          true,
        );
      }
    }
    console.error("Streamer.bot wheel spin failed:", requestId, error);
    return respond(500, { error: "Koleso sa nepodarilo roztočiť." });
  }
}
