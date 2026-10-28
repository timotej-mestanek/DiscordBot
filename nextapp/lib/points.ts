import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTwitchUserNames } from "@/lib/services/twitchPublic";

export const POINT_CURRENCIES = ["discord", "twitch_custom"] as const;
export type SupportedPointCurrency = (typeof POINT_CURRENCIES)[number];

type AccountIdentity = {
  provider: string;
  provider_user_id: string;
  display_name: string;
};

type PointTransactionClient = Prisma.TransactionClient;

const POINT_NAME_CACHE_TTL_MS = 5 * 60_000;
const pointNameCache = new Map<string, { name: string | null; expiresAt: number }>();
const pendingPointNameLookups = new Map<string, Promise<string | null>>();

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

async function lookupPointName(
  provider: "discord" | "twitch",
  providerUserId: string,
): Promise<string | null> {
  const key = `${provider}:${providerUserId}`;
  const cached = pointNameCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.name;
  const pending = pendingPointNameLookups.get(key);
  if (pending) return pending;

  const lookup = (async () => {
    try {
      if (provider === "discord") {
        const token = process.env.DISCORD_BOT_TOKEN;
        if (!token) return null;
        const response = await fetch(
          `https://discord.com/api/v10/users/${encodeURIComponent(providerUserId)}`,
          { headers: { Authorization: `Bot ${token}` } },
        );
        if (!response.ok) {
          console.error("Discord leaderboard name lookup failed:", response.status);
          return null;
        }
        const body: unknown = await response.json();
        if (
          typeof body !== "object" ||
          body === null ||
          !("username" in body) ||
          typeof body.username !== "string"
        ) {
          console.error("Discord leaderboard name lookup returned an invalid response.");
          return null;
        }
        const name =
          "global_name" in body && typeof body.global_name === "string"
            ? body.global_name.trim()
            : "";
        return name || body.username.trim() || null;
      }

      const names = await getTwitchUserNames([providerUserId]);
      return names.get(providerUserId) ?? null;
    } catch (error) {
      console.error(`${provider} leaderboard name lookup failed:`, error);
      return null;
    }
  })();
  pendingPointNameLookups.set(key, lookup);
  const name = await lookup;
  pendingPointNameLookups.delete(key);
  pointNameCache.set(key, { name, expiresAt: Date.now() + POINT_NAME_CACHE_TTL_MS });
  return name;
}

async function getPointDisplayName(
  provider: "discord" | "twitch",
  providerUserId: string,
  ...candidates: Array<string | null | undefined>
): Promise<string> {
  const usableName = candidates.find(
    (candidate) => candidate?.trim() && candidate.trim() !== providerUserId,
  );
  if (usableName) return usableName.trim();
  const resolvedName = await lookupPointName(provider, providerUserId);
  if (resolvedName && resolvedName !== providerUserId) return resolvedName;
  return provider === "discord" ? "Discord user" : "Twitch user";
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
          select: { twitch_user_id: true, twitch_user_login: true, points: true },
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
    const rows: Array<{
      provider: "discord" | "twitch";
      providerUserId: string;
      fallbackName: string;
      identityName?: string;
      points: number;
    }> =
      mode === "discord"
        ? discordBalances.map((item) => {
            const identity = identityByKey.get(`discord:${item.discord_id}`);
            return {
              provider: "discord",
              providerUserId: item.discord_id,
              fallbackName: item.name,
              identityName: identity?.display_name,
              points: item.points,
            };
          })
        : twitchBalances.map((item) => {
            const identity = identityByKey.get(`twitch:${item.twitch_user_id}`);
            return {
              provider: "twitch",
              providerUserId: item.twitch_user_id,
              fallbackName: item.twitch_user_login ?? item.twitch_user_id,
              identityName: identity?.display_name,
              points: item.points,
            };
          });
    return Promise.all(
      rows.slice(0, limit).map(async (row) => ({
        name: await getPointDisplayName(
          row.provider,
          row.providerUserId,
          row.identityName,
          row.fallbackName,
        ),
        points: row.points,
      })),
    );
  }

  const combined = new Map<
    string,
    {
      name: string;
      nameProvider: "discord" | "twitch";
      nameProviderUserId: string;
      points: number;
    }
  >();
  const addBalance = (
    provider: "discord" | "twitch",
    providerUserId: string,
    fallbackName: string,
    points: number,
  ) => {
    const identity = identityByKey.get(`${provider}:${providerUserId}`);
    const key = identity?.account_id ?? `${provider}:${providerUserId}`;
    const current = combined.get(key);
    const accountName = identity?.account.display_name;
    const identityName = identity?.display_name;
    const name =
      accountName && accountName !== providerUserId
        ? accountName
        : identityName && identityName !== providerUserId
          ? identityName
          : fallbackName;
    const currentHasReadableName =
      current && current.name !== current.nameProviderUserId;
    const hasReadableName = name !== providerUserId;
    combined.set(key, {
      name: currentHasReadableName && !hasReadableName ? current.name : name,
      nameProvider: currentHasReadableName && !hasReadableName ? current.nameProvider : provider,
      nameProviderUserId:
        currentHasReadableName && !hasReadableName
          ? current.nameProviderUserId
          : providerUserId,
      points: (current?.points ?? 0) + points,
    });
  };

  for (const item of discordBalances) {
    addBalance("discord", item.discord_id, item.name, item.points);
  }
  for (const item of twitchBalances) {
    addBalance(
      "twitch",
      item.twitch_user_id,
      item.twitch_user_login ?? item.twitch_user_id,
      item.points,
    );
  }

  const ranked = [...combined.values()]
    .sort((left, right) => right.points - left.points)
    .slice(0, limit);
  return Promise.all(
    ranked.map(async (entry) => ({
      name: await getPointDisplayName(
        entry.nameProvider,
        entry.nameProviderUserId,
        entry.name,
      ),
      points: entry.points,
    })),
  );
}

export async function changePointBalance(
  transaction: PointTransactionClient,
  currency: SupportedPointCurrency,
  providerUserId: string,
  delta: number,
  reason: string,
  actorAccountId: string | null,
  sourceEventId: string | null = null,
  twitchUserLogin?: string,
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
      create: {
        twitch_user_id: providerUserId,
        twitch_user_login: twitchUserLogin,
        points: delta,
      },
      update: {
        points: { increment: delta },
        ...(twitchUserLogin ? { twitch_user_login: twitchUserLogin } : {}),
      },
    });
  } else {
    const update = await transaction.twitchCustomPointBalance.updateMany({
      where: { twitch_user_id: providerUserId, points: { gte: -delta } },
      data: {
        points: { decrement: -delta },
        ...(twitchUserLogin ? { twitch_user_login: twitchUserLogin } : {}),
      },
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
