import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const POINT_CURRENCIES = ["discord", "twitch_custom"] as const;
export type SupportedPointCurrency = (typeof POINT_CURRENCIES)[number];

type AccountIdentity = {
  provider: string;
  provider_user_id: string;
  display_name: string;
};

type PointTransactionClient = Prisma.TransactionClient;

export class InsufficientPointsError extends Error {
  constructor() {
    super("Insufficient points.");
    this.name = "InsufficientPointsError";
  }
}

export function isSupportedPointCurrency(
  value: unknown,
): value is SupportedPointCurrency {
  return value === "discord" || value === "twitch_custom";
}

export async function getAccountPointBalances(identities: AccountIdentity[]) {
  const discordIdentity = identities.find((identity) => identity.provider === "discord");
  const twitchIdentity = identities.find((identity) => identity.provider === "twitch");

  const [discord, twitchCustom] = await Promise.all([
    discordIdentity
      ? prisma.discordEntity.findUnique({
          where: { discord_id: discordIdentity.provider_user_id },
          select: { points: true },
        })
      : null,
    twitchIdentity
      ? prisma.twitchCustomPointBalance.findUnique({
          where: { twitch_user_id: twitchIdentity.provider_user_id },
          select: { points: true },
        })
      : null,
  ]);

  return {
    discord: discordIdentity ? discord?.points ?? 0 : null,
    twitchCustom: twitchIdentity ? twitchCustom?.points ?? 0 : null,
    twitchChannelPoints: null,
  };
}

export async function getPointRanking(
  mode: "discord" | "twitch" | "overall",
  limit = 20,
) {
  const [discordBalances, twitchBalances] = await Promise.all([
    mode === "twitch"
      ? []
      : prisma.discordEntity.findMany({
          where: { points: { gt: 0 } },
          orderBy: { points: "desc" },
          select: { discord_id: true, name: true, points: true },
        }),
    mode === "discord"
      ? []
      : prisma.twitchCustomPointBalance.findMany({
          where: { points: { gt: 0 } },
          orderBy: { points: "desc" },
          select: { twitch_user_id: true, points: true },
        }),
  ]);

  const identities = await prisma.oAuthIdentity.findMany({
    where: {
      OR: [
        {
          provider: "discord",
          provider_user_id: { in: discordBalances.map((item) => item.discord_id) },
        },
        {
          provider: "twitch",
          provider_user_id: { in: twitchBalances.map((item) => item.twitch_user_id) },
        },
      ],
    },
    select: {
      provider: true,
      provider_user_id: true,
      display_name: true,
      account_id: true,
      account: { select: { display_name: true } },
    },
  });
  const identityByKey = new Map(
    identities.map((identity) => [
      `${identity.provider}:${identity.provider_user_id}`,
      identity,
    ]),
  );

  if (mode !== "overall") {
    const rows =
      mode === "discord"
        ? discordBalances.map((item) => {
            const identity = identityByKey.get(`discord:${item.discord_id}`);
            return {
              name: identity?.display_name ?? item.name,
              points: item.points,
            };
          })
        : twitchBalances.map((item) => {
            const identity = identityByKey.get(`twitch:${item.twitch_user_id}`);
            return {
              name: identity?.display_name ?? item.twitch_user_id,
              points: item.points,
            };
          });
    return rows.slice(0, limit);
  }

  const combined = new Map<string, { name: string; points: number }>();
  const addBalance = (
    provider: "discord" | "twitch",
    providerUserId: string,
    fallbackName: string,
    points: number,
  ) => {
    const identity = identityByKey.get(`${provider}:${providerUserId}`);
    const key = identity?.account_id ?? `${provider}:${providerUserId}`;
    const current = combined.get(key);
    combined.set(key, {
      name: identity?.account.display_name ?? identity?.display_name ?? fallbackName,
      points: (current?.points ?? 0) + points,
    });
  };

  for (const item of discordBalances) {
    addBalance("discord", item.discord_id, item.name, item.points);
  }
  for (const item of twitchBalances) {
    addBalance("twitch", item.twitch_user_id, item.twitch_user_id, item.points);
  }

  return [...combined.values()]
    .sort((left, right) => right.points - left.points)
    .slice(0, limit);
}

export async function changePointBalance(
  transaction: PointTransactionClient,
  currency: SupportedPointCurrency,
  providerUserId: string,
  delta: number,
  reason: string,
  actorAccountId: string | null,
  sourceEventId: string | null = null,
): Promise<void> {
  if (currency === "discord") {
    if (delta > 0) {
      await transaction.discordEntity.upsert({
        where: { discord_id: providerUserId },
        create: { discord_id: providerUserId, name: providerUserId, points: delta },
        update: { points: { increment: delta } },
      });
    } else {
      const update = await transaction.discordEntity.updateMany({
        where: { discord_id: providerUserId, points: { gte: -delta } },
        data: { points: { decrement: -delta } },
      });
      if (update.count !== 1) throw new InsufficientPointsError();
    }
  } else if (delta > 0) {
    await transaction.twitchCustomPointBalance.upsert({
      where: { twitch_user_id: providerUserId },
      create: { twitch_user_id: providerUserId, points: delta },
      update: { points: { increment: delta } },
    });
  } else {
    const update = await transaction.twitchCustomPointBalance.updateMany({
      where: { twitch_user_id: providerUserId, points: { gte: -delta } },
      data: { points: { decrement: -delta } },
    });
    if (update.count !== 1) throw new InsufficientPointsError();
  }

  await transaction.pointLedgerEntry.create({
    data: {
      currency,
      provider_user_id: providerUserId,
      delta,
      reason,
      actor_account_id: actorAccountId,
      source_event_id: sourceEventId,
    },
  });
}

export async function adjustPoints(input: {
  currency: SupportedPointCurrency;
  providerUserId: string;
  delta: number;
  reason: string;
  actorAccountId: string | null;
  targetAccountId?: string;
  sourceEventId?: string;
}) {
  return prisma.$transaction(async (transaction) => {
    await changePointBalance(
      transaction,
      input.currency,
      input.providerUserId,
      input.delta,
      input.reason,
      input.actorAccountId,
      input.sourceEventId ?? null,
    );
    if (input.actorAccountId) {
      await transaction.adminAuditLog.create({
        data: {
          actor_account_id: input.actorAccountId,
          target_account_id: input.targetAccountId ?? input.actorAccountId,
          action: "points.adjusted",
          details: {
            currency: input.currency,
            providerUserId: input.providerUserId,
            delta: input.delta,
            reason: input.reason,
          },
        },
      });
    }
  });
}

export async function convertPoints(input: {
  accountId: string;
  identities: AccountIdentity[];
  source: SupportedPointCurrency;
  target: SupportedPointCurrency;
  sourceAmount: number;
}) {
  if (input.source === input.target) throw new Error("Choose two different currencies.");
  const sourceIdentity = input.identities.find((identity) =>
    input.source === "discord"
      ? identity.provider === "discord"
      : identity.provider === "twitch",
  );
  const targetIdentity = input.identities.find((identity) =>
    input.target === "discord"
      ? identity.provider === "discord"
      : identity.provider === "twitch",
  );
  if (!sourceIdentity || !targetIdentity) {
    throw new Error("Link both accounts before converting points.");
  }

  return prisma.$transaction(async (transaction) => {
    const rate = await transaction.pointConversionRate.findUnique({
      where: {
        source_currency_target_currency: {
          source_currency: input.source,
          target_currency: input.target,
        },
      },
    });
    if (!rate?.enabled || rate.source_amount <= 0 || rate.target_amount <= 0) {
      throw new Error("This conversion is currently unavailable.");
    }
    if (input.sourceAmount < rate.source_amount || input.sourceAmount % rate.source_amount !== 0) {
      throw new Error(`Amount must be a multiple of ${rate.source_amount}.`);
    }
    const targetAmount =
      (input.sourceAmount / rate.source_amount) * rate.target_amount;
    if (!Number.isSafeInteger(targetAmount) || targetAmount <= 0) {
      throw new Error("The conversion amount is outside the supported range.");
    }

    await changePointBalance(
      transaction,
      input.source,
      sourceIdentity.provider_user_id,
      -input.sourceAmount,
      `Conversion to ${input.target}`,
      input.accountId,
    );
    await changePointBalance(
      transaction,
      input.target,
      targetIdentity.provider_user_id,
      targetAmount,
      `Conversion from ${input.source}`,
      input.accountId,
    );
    await transaction.adminAuditLog.create({
      data: {
        actor_account_id: input.accountId,
        target_account_id: input.accountId,
        action: "points.converted",
        details: {
          source: input.source,
          target: input.target,
          sourceAmount: input.sourceAmount,
          targetAmount,
        },
      },
    });

    return { targetAmount };
  });
}
