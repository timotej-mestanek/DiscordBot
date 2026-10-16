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

export async function POST(request: Request) {
  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    console.error("Streamer.bot currency integration is not configured.");
    return NextResponse.json(
      { error: "Streamer.bot integrácia nie je nakonfigurovaná." },
      { status: 503 },
    );
  }
  if (authorization === "unauthorized") {
    return NextResponse.json({ error: "Neplatná autorizácia." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatné dáta požiadavky." }, { status: 400 });
  }
  if (!isRecord(body) || typeof body.operation !== "string") {
    return NextResponse.json({ error: "Neplatná operácia meny." }, { status: 400 });
  }

  if (body.operation === "balance") {
    if (!isTwitchUserId(body.twitchUserId)) {
      return NextResponse.json({ error: "Neplatné Twitch ID." }, { status: 400 });
    }
    try {
      const balance = await prisma.twitchCustomPointBalance.findUnique({
        where: { twitch_user_id: body.twitchUserId },
        select: { points: true },
      });
      return NextResponse.json({ ok: true, points: balance?.points ?? 0 });
    } catch (error) {
      console.error("Streamer.bot currency balance lookup failed:", error);
      return NextResponse.json(
        { error: "Zůstatek bodů se nepodařilo načíst." },
        { status: 500 },
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
      return NextResponse.json(
        { error: "Neplatné údaje pro změnu bodů." },
        { status: 400 },
      );
    }

    const eventId = body.eventId;
    const operation = body.operation;
    const delta = operation === "add" ? body.amount : -body.amount;
    try {
      const twitchUserId = await resolveBodyUserId(
        body,
        "twitchUserId",
        "twitchUserLogin",
      );
      if (!twitchUserId) {
        return NextResponse.json({ error: "Twitch používateľ sa nenašiel." }, { status: 404 });
      }
      await prisma.$transaction(async (transaction) => {
        await changePointBalance(
          transaction,
          "twitch_custom",
          twitchUserId,
          delta,
          operation === "add" ? "Streamer.bot: add points" : "Streamer.bot: remove points",
          null,
          eventId,
        );
      });
      const balance = await prisma.twitchCustomPointBalance.findUniqueOrThrow({
        where: { twitch_user_id: twitchUserId },
        select: { points: true },
      });
      return NextResponse.json({ ok: true, duplicate: false, points: balance.points });
    } catch (error) {
      if (isDuplicateEvent(error)) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      if (error instanceof InsufficientPointsError) {
        return NextResponse.json(
          { error: "Používateľ nemá dostatok bodov." },
          { status: 409 },
        );
      }
      if (error instanceof Error && error.message.startsWith("Twitch ")) {
        console.error("Streamer.bot Twitch user lookup failed:", error);
        return NextResponse.json(
          { error: "Twitch používateľa sa nepodarilo overiť." },
          { status: 502 },
        );
      }
      console.error("Streamer.bot currency adjustment failed:", error);
      return NextResponse.json(
        { error: "Změnu bodů se nepodařilo uložit." },
        { status: 500 },
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
      return NextResponse.json(
        { error: "Neplatné údaje pro převod bodů." },
        { status: 400 },
      );
    }

    const eventId = body.eventId;
    const fromTwitchUserId = body.fromTwitchUserId;
    const amount = body.amount;
    try {
      const toTwitchUserId = await resolveBodyUserId(
        body,
        "toTwitchUserId",
        "toTwitchUserLogin",
      );
      if (!toTwitchUserId) {
        return NextResponse.json({ error: "Twitch používateľ sa nenašiel." }, { status: 404 });
      }
      if (fromTwitchUserId === toTwitchUserId) {
        return NextResponse.json(
          { error: "Body si nemôžeš poslať sám sebe." },
          { status: 400 },
        );
      }
      await prisma.$transaction(async (transaction) => {
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
        );
      });
      const balances = await prisma.twitchCustomPointBalance.findMany({
        where: {
          twitch_user_id: {
            in: [fromTwitchUserId, toTwitchUserId],
          },
        },
        select: { twitch_user_id: true, points: true },
      });
      const balanceById = new Map(
        balances.map((balance) => [balance.twitch_user_id, balance.points]),
      );
      return NextResponse.json({
        ok: true,
        duplicate: false,
        fromPoints: balanceById.get(fromTwitchUserId) ?? 0,
        toPoints: balanceById.get(toTwitchUserId) ?? 0,
      });
    } catch (error) {
      if (isDuplicateEvent(error)) {
        return NextResponse.json({ ok: true, duplicate: true });
      }
      if (error instanceof InsufficientPointsError) {
        return NextResponse.json(
          { error: "Nemáš dostatek bodů pro tento převod." },
          { status: 409 },
        );
      }
      if (error instanceof Error && error.message.startsWith("Twitch ")) {
        console.error("Streamer.bot Twitch user lookup failed:", error);
        return NextResponse.json(
          { error: "Twitch používateľa sa nepodarilo overiť." },
          { status: 502 },
        );
      }
      console.error("Streamer.bot currency transfer failed:", error);
      return NextResponse.json(
        { error: "Převod bodů se nepodařilo uložit." },
        { status: 500 },
      );
    }
  }

  return NextResponse.json({ error: "Neznámá operace měny." }, { status: 400 });
}
