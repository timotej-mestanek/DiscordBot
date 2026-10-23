import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { changePointBalance, InsufficientPointsError } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import {
  authorizeStreamerBotRequest,
  isTwitchLogin,
  resolveTwitchUserId,
} from "@/lib/integrations/streamerbot";

const MAX_AMOUNT = 1_000_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTwitchUserId(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,32}$/.test(value);
}

async function resolveBodyUserId(
  body: Record<string, unknown>,
  idKey: string,
  loginKey: string,
): Promise<string | null> {
  const id = body[idKey];
  if (isTwitchUserId(id)) return id;
  const login = body[loginKey];
  if (isTwitchLogin(login)) return resolveTwitchUserId(login);
  return null;
}

function isEventId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 180;
}

function isAmount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value <= MAX_AMOUNT
  );
}

function isDuplicateEvent(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  );
}

function redactSensitiveFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactSensitiveFields);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [
      key,
      /token|authorization|secret|password/i.test(key)
        ? "[REDACTED]"
        : redactSensitiveFields(entry),
    ]),
  );
}

function stringifyDetails(value: unknown, maxLength: number): string {
  const serialized = JSON.stringify(redactSensitiveFields(value));
  return serialized.length > maxLength
    ? `${serialized.slice(0, maxLength)}…[truncated]`
    : serialized;
}

async function persistRequestLog(input: {
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
    console.error("Failed to persist Streamer.bot currency request log:", input.requestId, error);
  }
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  let requestDetails: string | null = null;
  let operation: string | null = null;
  console.log("Streamer.bot currency request received:", requestId, request.method, request.url);
  const respond = async (
    statusCode: number,
    responseBody: Record<string, unknown>,
    success = false,
  ) => {
    const responseDetails = stringifyDetails(responseBody, 4_000);
    await persistRequestLog({
      requestId,
      operation,
      success,
      statusCode,
      requestDetails,
      responseDetails,
    });
    if (success) {
      console.log("Streamer.bot currency request succeeded:", requestId, operation, responseDetails);
    } else {
      console.error("Streamer.bot currency request failed:", requestId, operation, statusCode, responseDetails);
    }
    return NextResponse.json(responseBody, { status: statusCode });
  };
  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    console.error("Streamer.bot currency integration is not configured.");
    return respond(
      503,
      { error: "Streamer.bot integrácia nie je nakonfigurovaná." },
    );
  }
  if (authorization === "unauthorized") {
    console.error("Streamer.bot currency request rejected: unauthorized.");
    return respond(401, { error: "Neplatná autorizácia." });
  }

  let body: unknown;
  try {
    body = await request.json();
    requestDetails = stringifyDetails(body, 10_000);
    console.log(
      "Streamer.bot currency request body:",
      requestDetails,
    );
  } catch {
    console.error("Streamer.bot currency request rejected: invalid JSON body.");
    return respond(400, { error: "Neplatné dáta požiadavky." });
  }
  if (!isRecord(body) || typeof body.operation !== "string") {
    console.error("Streamer.bot currency request rejected: missing operation.");
    return respond(400, { error: "Neplatná operácia meny." });
  }
  operation = body.operation;

  if (body.operation === "balance") {
    if (!isTwitchUserId(body.twitchUserId)) {
      console.error("Streamer.bot currency balance rejected: invalid Twitch user ID.");
      return respond(400, { error: "Neplatné Twitch ID." });
    }
    try {
      const balance = await prisma.twitchCustomPointBalance.findUnique({
        where: { twitch_user_id: body.twitchUserId },
        select: { points: true },
      });
      console.log(
        "Streamer.bot currency balance succeeded:",
        body.twitchUserId,
        balance?.points ?? 0,
      );
      return respond(200, { ok: true, points: balance?.points ?? 0 }, true);
    } catch (error) {
      console.error("Streamer.bot currency balance lookup failed:", error);
      return respond(
        500,
        { error: "Zůstatek bodů se nepodařilo načíst." },
      );
    }
  }

  if (body.operation === "add" || body.operation === "remove") {
    if (
      !isEventId(body.eventId) ||
      (!isTwitchUserId(body.twitchUserId) &&
        !isTwitchLogin(body.twitchUserLogin)) ||
      !isAmount(body.amount)
    ) {
      console.error(
        "Streamer.bot currency adjustment rejected: invalid event ID, Twitch user, or amount.",
      );
      return respond(
        400,
        { error: "Neplatné údaje pro změnu bodů." },
      );
    }

    const eventId = body.eventId;
    const operation = body.operation;
    const amount = body.amount;
    const twitchUserLogin =
      typeof body.twitchUserLogin === "string" ? body.twitchUserLogin : null;
    const delta = operation === "add" ? amount : -amount;
    try {
      const twitchUserId = await resolveBodyUserId(
        body,
        "twitchUserId",
        "twitchUserLogin",
      );
      if (!twitchUserId) {
        console.error("Streamer.bot currency adjustment failed: Twitch user not found.");
        return respond(404, { error: "Twitch používateľ sa nenašiel." });
      }
      const points = await prisma.$transaction(async (transaction) => {
        await changePointBalance(
          transaction,
          "twitch_custom",
          twitchUserId,
          delta,
          operation === "add" ? "Streamer.bot: add points" : "Streamer.bot: remove points",
          null,
          eventId,
          isTwitchLogin(twitchUserLogin)
            ? twitchUserLogin.toLowerCase()
            : undefined,
        );
        const balance = await transaction.twitchCustomPointBalance.findUniqueOrThrow({
          where: { twitch_user_id: twitchUserId },
          select: { points: true },
        });
        await transaction.adminAuditLog.create({
          data: {
            action: "points.streamerbot.adjusted",
            details: {
              operation,
              currency: "twitch_custom",
              twitchUserId,
              twitchUserLogin,
              amount,
              delta,
              eventId,
              balance: balance.points,
            },
          },
        });
        return balance.points;
      });
      console.log(
        "Streamer.bot currency adjustment succeeded:",
        operation,
        twitchUserId,
        delta,
        points,
        eventId,
      );
      return respond(200, { ok: true, duplicate: false, points }, true);
    } catch (error) {
      if (isDuplicateEvent(error)) {
        console.log("Streamer.bot currency adjustment duplicate ignored:", eventId);
        return respond(200, { ok: true, duplicate: true }, true);
      }
      if (error instanceof InsufficientPointsError) {
        console.error("Streamer.bot currency adjustment rejected: insufficient points.", eventId);
        return respond(
          409,
          { error: "Používateľ nemá dostatok bodov." },
        );
      }
      if (error instanceof Error && error.message.startsWith("Twitch ")) {
        console.error("Streamer.bot Twitch user lookup failed:", error);
        return respond(
          502,
          { error: "Twitch používateľa sa nepodarilo overiť." },
        );
      }
      console.error("Streamer.bot currency adjustment failed:", error);
      return respond(
        500,
        { error: "Změnu bodů se nepodařilo uložit." },
      );
    }
  }

  if (body.operation === "give") {
    if (
      !isEventId(body.eventId) ||
      !isTwitchUserId(body.fromTwitchUserId) ||
      (!isTwitchUserId(body.toTwitchUserId) &&
        !isTwitchLogin(body.toTwitchUserLogin)) ||
      !isAmount(body.amount)
    ) {
      console.error(
        "Streamer.bot currency transfer rejected: invalid event ID, sender, recipient, or amount.",
      );
      return respond(
        400,
        { error: "Neplatné údaje pro převod bodů." },
      );
    }

    const eventId = body.eventId;
    const fromTwitchUserId = body.fromTwitchUserId;
    const amount = body.amount;
    const toTwitchUserLogin =
      typeof body.toTwitchUserLogin === "string" ? body.toTwitchUserLogin : null;
    try {
      const toTwitchUserId = await resolveBodyUserId(
        body,
        "toTwitchUserId",
        "toTwitchUserLogin",
      );
      if (!toTwitchUserId) {
        console.error("Streamer.bot currency transfer failed: Twitch recipient not found.");
        return respond(404, { error: "Twitch používateľ sa nenašiel." });
      }
      if (fromTwitchUserId === toTwitchUserId) {
        console.error("Streamer.bot currency transfer rejected: sender and recipient match.");
        return respond(
          400,
          { error: "Body si nemôžeš poslať sám sebe." },
        );
      }
      const balances = await prisma.$transaction(async (transaction) => {
        await changePointBalance(
          transaction,
          "twitch_custom",
          fromTwitchUserId,
          -amount,
          "Streamer.bot: points transfer",
          null,
          `${eventId}:from`,
        );
        await changePointBalance(
          transaction,
          "twitch_custom",
          toTwitchUserId,
          amount,
          "Streamer.bot: points transfer",
          null,
          `${eventId}:to`,
          isTwitchLogin(toTwitchUserLogin)
            ? toTwitchUserLogin.toLowerCase()
            : undefined,
        );
        const updated = await transaction.twitchCustomPointBalance.findMany({
          where: {
            twitch_user_id: { in: [fromTwitchUserId, toTwitchUserId] },
          },
          select: { twitch_user_id: true, points: true },
        });
        const balanceById = new Map(
          updated.map((balance) => [balance.twitch_user_id, balance.points]),
        );
        const fromPoints = balanceById.get(fromTwitchUserId) ?? 0;
        const toPoints = balanceById.get(toTwitchUserId) ?? 0;
        await transaction.adminAuditLog.create({
          data: {
            action: "points.streamerbot.transferred",
            details: {
              operation: "give",
              currency: "twitch_custom",
              fromTwitchUserId,
              toTwitchUserId,
              toTwitchUserLogin,
              amount,
              eventId,
              fromPoints,
              toPoints,
            },
          },
        });
        return { fromPoints, toPoints };
      });
      console.log(
        "Streamer.bot currency transfer succeeded:",
        fromTwitchUserId,
        toTwitchUserId,
        amount,
        balances.fromPoints,
        balances.toPoints,
        eventId,
      );
      return respond(
        200,
        {
          ok: true,
          duplicate: false,
          fromPoints: balances.fromPoints,
          toPoints: balances.toPoints,
        },
        true,
      );
    } catch (error) {
      if (isDuplicateEvent(error)) {
        console.log("Streamer.bot currency transfer duplicate ignored:", eventId);
        return respond(200, { ok: true, duplicate: true }, true);
      }
      if (error instanceof InsufficientPointsError) {
        console.error("Streamer.bot currency transfer rejected: insufficient points.", eventId);
        return respond(
          409,
          { error: "Nemáš dostatek bodů pro tento převod." },
        );
      }
      if (error instanceof Error && error.message.startsWith("Twitch ")) {
        console.error("Streamer.bot Twitch user lookup failed:", error);
        return respond(
          502,
          { error: "Twitch používateľa sa nepodarilo overiť." },
        );
      }
      console.error("Streamer.bot currency transfer failed:", error);
      return respond(
        500,
        { error: "Převod bodů se nepodařilo uložit." },
      );
    }
  }

  console.error("Streamer.bot currency request rejected: unknown operation.", body.operation);
  return respond(400, { error: "Neznámá operace měny." });
}
