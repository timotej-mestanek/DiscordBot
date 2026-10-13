import { Platform } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CommunityRankingEntry = {
  userId: string;
  name: string;
  total: number;
};

export type ProfanityCategoryRanking = {
  category: string;
  entries: CommunityRankingEntry[];
};

type RankingPlatform = Platform | "all";

async function getRecentDisplayNames(
  platform: RankingPlatform,
  userIds: string[],
): Promise<Map<string, string>> {
  if (userIds.length === 0) return new Map();

  const events = await prisma.streamerBotChatMetricEvent.findMany({
    where: {
      provider_user_id: { in: userIds },
      ...(platform === "all" ? {} : { platform }),
    },
    orderBy: { created_at: "desc" },
    select: { platform: true, provider_user_id: true, display_name: true },
  });
  const names = new Map<string, string>();
  for (const event of events) {
    const key = `${event.platform}:${event.provider_user_id}`;
    if (!names.has(key)) names.set(key, event.display_name);
  }
  return names;
}

export async function getProfanityRanking(
  limit = 50,
): Promise<CommunityRankingEntry[]> {
  const totals = await prisma.streamerBotChatMetricEvent.groupBy({
    by: ["platform", "provider_user_id"],
    _sum: { profanity_count: true },
    orderBy: { _sum: { profanity_count: "desc" } },
    take: limit,
  });
  const names = await getRecentDisplayNames(
    "all",
    totals.map((row) => row.provider_user_id),
  );
  return totals.map((row) => ({
    userId: row.provider_user_id,
    name:
      names.get(`${row.platform}:${row.provider_user_id}`) ??
      row.provider_user_id,
    total: row._sum.profanity_count ?? 0,
  }));
}

export async function getProfanityCategoryRankings(
  limit = 50,
): Promise<ProfanityCategoryRanking[]> {
  const totals = await prisma.profanityCategoryEvent.groupBy({
    by: ["category", "platform", "provider_user_id"],
    _sum: { weighted_score: true },
    orderBy: { _sum: { weighted_score: "desc" } },
  });
  const userIds = [...new Set(totals.map((row) => row.provider_user_id))];
  const events =
    userIds.length === 0
      ? []
      : await prisma.profanityCategoryEvent.findMany({
          where: { provider_user_id: { in: userIds } },
          orderBy: { created_at: "desc" },
          select: {
            platform: true,
            provider_user_id: true,
            display_name: true,
          },
        });
  const names = new Map<string, string>();
  for (const event of events) {
    const key = `${event.platform}:${event.provider_user_id}`;
    if (!names.has(key)) names.set(key, event.display_name);
  }

  const categories = new Map<string, CommunityRankingEntry[]>();
  for (const row of totals) {
    const entries = categories.get(row.category) ?? [];
    if (entries.length >= limit) continue;
    entries.push({
      userId: row.provider_user_id,
      name:
        names.get(`${row.platform}:${row.provider_user_id}`) ??
        row.provider_user_id,
      total: row._sum.weighted_score ?? 0,
    });
    categories.set(row.category, entries);
  }

  return [...categories.entries()]
    .map(([category, entries]) => ({ category, entries }))
    .sort((a, b) => a.category.localeCompare(b.category));
}

export async function getGamblingRanking(
  platform: Platform,
  limit = 50,
): Promise<CommunityRankingEntry[]> {
  const totals = await prisma.gamblingEvent.groupBy({
    by: ["provider_user_id"],
    where: { platform },
    _sum: { amount: true },
    orderBy: { _sum: { amount: "desc" } },
    take: limit,
  });
  const events = await prisma.gamblingEvent.findMany({
    where: {
      platform,
      provider_user_id: { in: totals.map((row) => row.provider_user_id) },
    },
    orderBy: { created_at: "desc" },
    select: { provider_user_id: true, display_name: true },
  });
  const names = new Map<string, string>();
  for (const event of events) {
    if (!names.has(event.provider_user_id)) {
      names.set(event.provider_user_id, event.display_name);
    }
  }
  return totals.map((row) => ({
    userId: row.provider_user_id,
    name: names.get(row.provider_user_id) ?? row.provider_user_id,
    total: row._sum.amount ?? 0,
  }));
}

export async function getCommunityLeaderboardSnapshot() {
  const [profanity, profanityCategories, twitchGambling, discordGambling] =
    await Promise.all([
    getProfanityRanking(),
    getProfanityCategoryRankings(),
    getGamblingRanking(Platform.twitch),
    getGamblingRanking(Platform.discord),
  ]);
  return { profanity, profanityCategories, twitchGambling, discordGambling };
}
