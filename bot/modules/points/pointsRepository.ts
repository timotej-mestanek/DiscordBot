import { Platform } from "@prisma/client";
import { prisma } from "../../lib/prisma";

const MAX_POINTS = 2_147_483_647;

export class PointsBalanceLimitError extends Error {
  constructor() {
    super("Výsledný zůstatek by překročil maximální podporovaný počet bodů.");
    this.name = "PointsBalanceLimitError";
  }
}

export const getUserPoints = async (userId: string) => {
  const user = await prisma.discordEntity.findUnique({
    where: { discord_id: userId },
  });

  return user?.points ?? 0;
};

export const getTopUsers = async (take = 5) => {
  return prisma.discordEntity.findMany({
    orderBy: { points: "desc" },
    take,
  });
};

export const incrementPoints = async (userId: string, amount: number) => {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new RangeError("Připsané body musí být kladné celé číslo.");
  }

  const update = await prisma.discordEntity.updateMany({
    where: {
      discord_id: userId,
      points: { lte: MAX_POINTS - amount },
    },
    data: { points: { increment: amount } },
  });
  if (update.count === 0) {
    const user = await prisma.discordEntity.findUnique({
      where: { discord_id: userId },
      select: { id: true },
    });
    if (!user) throw new Error(`Discord uživatel ${userId} nemá účet s body.`);
    throw new PointsBalanceLimitError();
  }

  return prisma.discordEntity.findUniqueOrThrow({
    where: { discord_id: userId },
  });
};

export async function settleBet(
  userId: string,
  stake: number,
  payout: number,
  event: {
    sourceEventId: string;
    displayName: string;
    activity: string;
    outcome: string;
  },
) {
  if (
    !Number.isSafeInteger(stake) ||
    stake <= 0 ||
    !Number.isSafeInteger(payout) ||
    payout < 0
  ) {
    throw new RangeError("Sázka a výhra musí být platná celá čísla.");
  }

  return prisma.$transaction(async (tx) => {
    const debit = await tx.discordEntity.updateMany({
      where: {
        discord_id: userId,
        points: { gte: stake },
      },
      data: { points: { decrement: stake } },
    });

    if (debit.count === 0) return null;

    const debitedUser = await tx.discordEntity.findUniqueOrThrow({
      where: { discord_id: userId },
      select: { points: true },
    });
    if (debitedUser.points + payout > MAX_POINTS) {
      throw new PointsBalanceLimitError();
    }

    if (payout > 0) {
      await tx.discordEntity.update({
        where: { discord_id: userId },
        data: { points: { increment: payout } },
      });
    }

    const user = await tx.discordEntity.findUniqueOrThrow({
      where: { discord_id: userId },
      select: { points: true },
    });

    await tx.gamblingEvent.create({
      data: {
        source_event_id: `discord:${event.sourceEventId}`,
        platform: Platform.discord,
        provider_user_id: userId,
        display_name: event.displayName,
        activity: event.activity,
        amount: stake,
        payout,
        won: payout > 0,
        outcome: event.outcome,
      },
    });

    return user.points;
  });
}
