import { randomInt } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import {
  changePointBalance,
  InsufficientPointsError,
  isSupportedPointCurrency,
  type SupportedPointCurrency,
} from "@/lib/points";
import { prisma } from "@/lib/prisma";

const MAX_POINT_BALANCE = 2_147_483_647;
const redNumbers = new Set([
  1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36,
]);

type Game = "coin" | "roulette" | "dice";
type RouletteColor = "red" | "black" | "green";
type Selection =
  | { kind: "coin"; side: "heads" | "tails" }
  | { kind: "roulette-color"; color: RouletteColor }
  | { kind: "roulette-number"; number: number }
  | { kind: "dice-sum"; sum: number }
  | { kind: "dice-range"; min: number; max: number };
type GameVisual =
  | { kind: "coin"; side: "heads" | "tails" }
  | { kind: "roulette"; number: number; color: "red" | "black" | "green" }
  | { kind: "dice"; first: number; second: number; sum: number };

class InvalidBetError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum
  );
}

function parseSelection(game: Game, value: unknown): Selection | null {
  if (!isRecord(value) || typeof value.kind !== "string") return null;

  if (
    game === "coin" &&
    value.kind === "coin" &&
    (value.side === "heads" || value.side === "tails")
  ) {
    return { kind: "coin", side: value.side };
  }
  if (
    game === "roulette" &&
    value.kind === "roulette-color" &&
    (value.color === "red" || value.color === "black" || value.color === "green")
  ) {
    return { kind: "roulette-color", color: value.color };
  }
  if (
    game === "roulette" &&
    value.kind === "roulette-number" &&
    isIntegerInRange(value.number, 0, 36)
  ) {
    return { kind: "roulette-number", number: value.number };
  }
  if (
    game === "dice" &&
    value.kind === "dice-sum" &&
    isIntegerInRange(value.sum, 2, 12)
  ) {
    return { kind: "dice-sum", sum: value.sum };
  }
  if (
    game === "dice" &&
    value.kind === "dice-range" &&
    isIntegerInRange(value.min, 2, 12) &&
    isIntegerInRange(value.max, value.min, 12)
  ) {
    return { kind: "dice-range", min: value.min, max: value.max };
  }
  return null;
}

function getMultiplier(selection: Selection): number {
  if (selection.kind === "coin") return 2;
  if (selection.kind === "roulette-color") {
    return selection.color === "green" ? 36 : 2;
  }
  if (selection.kind === "roulette-number") return 36;

  const waysForSum = (sum: number) => (sum <= 7 ? sum - 1 : 13 - sum);
  const winningWays =
    selection.kind === "dice-sum"
      ? waysForSum(selection.sum)
      : Array.from(
          { length: selection.max - selection.min + 1 },
          (_, index) => selection.min + index,
        ).reduce((total, sum) => total + waysForSum(sum), 0);
  return Math.floor(36 / winningWays);
}

async function getBalance(
  transaction: Prisma.TransactionClient,
  currency: SupportedPointCurrency,
  providerUserId: string,
) {
  if (currency === "discord") {
    const balance = await transaction.discordEntity.findUnique({
      where: { discord_id: providerUserId },
      select: { points: true },
    });
    return balance?.points ?? 0;
  }
  const balance = await transaction.twitchCustomPointBalance.findUnique({
    where: { twitch_user_id: providerUserId },
    select: { points: true },
  });
  return balance?.points ?? 0;
}

function roll(
  game: Game,
  selection: Selection,
): { win: boolean; multiplier: number; message: string; visual: GameVisual } {
  if (game === "coin" && selection.kind === "coin") {
    const outcome = randomInt(0, 2) === 0 ? "heads" : "tails";
    return {
      win: outcome === selection.side,
      multiplier: 2,
      message: `The coin landed on ${outcome}.`,
      visual: { kind: "coin", side: outcome },
    };
  }

  if (game === "roulette") {
    const outcome = randomInt(0, 37);
    const color =
      outcome === 0 ? "green" : redNumbers.has(outcome) ? "red" : "black";
    const win =
      (selection.kind === "roulette-color" && selection.color === color) ||
      (selection.kind === "roulette-number" && selection.number === outcome);
    return {
      win,
      multiplier: getMultiplier(selection),
      message: `The wheel landed on ${outcome} (${color}).`,
      visual: { kind: "roulette", number: outcome, color },
    };
  }

  if (game === "dice") {
    const first = randomInt(1, 7);
    const second = randomInt(1, 7);
    const sum = first + second;
    const win =
      (selection.kind === "dice-sum" && selection.sum === sum) ||
      (selection.kind === "dice-range" &&
        sum >= selection.min &&
        sum <= selection.max);
    return {
      win,
      multiplier: getMultiplier(selection),
      message: `The dice rolled ${first} and ${second}, for a total of ${sum}.`,
      visual: { kind: "dice", first, second, sum },
    };
  }

  throw new InvalidBetError("Select a valid bet for this game.");
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ game: string }> },
) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Log in to play." }, { status: 401 });
  }

  const { game: gameParam } = await params;
  if (gameParam !== "coin" && gameParam !== "roulette" && gameParam !== "dice") {
    return NextResponse.json({ error: "Game not found." }, { status: 404 });
  }
  const game: Game = gameParam;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    !isSupportedPointCurrency(body.currency) ||
    !isIntegerInRange(body.amount, 1, MAX_POINT_BALANCE)
  ) {
    return NextResponse.json(
      { error: "Choose a currency and enter a positive whole-number bet." },
      { status: 400 },
    );
  }

  const selection = parseSelection(game, body.selection);
  if (!selection) {
    return NextResponse.json({ error: "Select a valid bet for this game." }, { status: 400 });
  }

  const currency = body.currency;
  const amount = body.amount;
  const identity = account.identities.find((item) =>
    currency === "discord" ? item.provider === "discord" : item.provider === "twitch",
  );
  if (!identity) {
    return NextResponse.json(
      { error: "Link the selected Twitch or Discord account before betting." },
      { status: 400 },
    );
  }

  try {
    // A thrown error rolls the stake and its ledger entry back with the transaction.
    const result = await prisma.$transaction(async (transaction) => {
      const currentBalance = await getBalance(
        transaction,
        currency,
        identity.provider_user_id,
      );
      if (amount > currentBalance) throw new InsufficientPointsError();

      const multiplier = getMultiplier(selection);
      if (
        multiplier > 1 &&
        amount >
          Math.floor((MAX_POINT_BALANCE - currentBalance) / (multiplier - 1))
      ) {
        throw new InvalidBetError(
          "That bet could exceed the maximum supported points balance.",
        );
      }

      await changePointBalance(
        transaction,
        currency,
        identity.provider_user_id,
        -amount,
        `Games: ${game}`,
        account.id,
      );

      const outcome = roll(game, selection);
      const payout = outcome.win ? amount * outcome.multiplier : 0;
      if (!Number.isSafeInteger(payout) || payout > MAX_POINT_BALANCE) {
        throw new InvalidBetError("The payout exceeds the supported points range.");
      }
      if (payout > 0) {
        await changePointBalance(
          transaction,
          currency,
          identity.provider_user_id,
          payout,
          `Games: ${game} payout`,
          account.id,
        );
      }

      const newBalance = await getBalance(
        transaction,
        currency,
        identity.provider_user_id,
      );
      return {
        win: outcome.win,
        payout,
        newBalance,
        message: `${outcome.message} ${outcome.win ? "You won." : "You lost."}`,
        visual: outcome.visual,
      };
    });
    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store, max-age=0" },
    });
  } catch (error) {
    if (error instanceof InsufficientPointsError) {
      return NextResponse.json(
        { error: "Your bet cannot exceed your current balance." },
        { status: 409 },
      );
    }
    if (error instanceof InvalidBetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Game play failed:", error);
    return NextResponse.json(
      { error: "Could not complete the game. Your bet was not charged." },
      { status: 500 },
    );
  }
}
