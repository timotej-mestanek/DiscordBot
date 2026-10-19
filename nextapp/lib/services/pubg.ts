import { unstable_cache } from "next/cache";

export type PubgDailyStats = {
  player: string;
  matches: number;
  kills: number;
  deaths: number;
  kd: number | null;
  longestKill: number;
  headshotRate: number;
  mostDamage: number;
  averageDamage: number;
};

type JsonRecord = Record<string, unknown>;
type RankedMatchStats = {
  stats: JsonRecord;
  createdAt: number;
};

const PROCESS_CACHE_TTL_MS = 300_000;
const processStatsCache = new Map<
  string,
  { expiresAt: number; stats: Promise<PubgDailyStats> }
>();

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStat(stats: JsonRecord, key: string): number {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getPragueDayStart(now: Date): { dayKey: string; start: number } {
  const dateParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const parts = Object.fromEntries(dateParts.map(({ type, value }) => [type, value]));
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  const dayKey = `${parts.year}-${parts.month}-${parts.day}`;
  const utcMidnight = Date.UTC(year, month - 1, day);

  const offsetParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    timeZoneName: "longOffset",
  }).formatToParts(new Date(utcMidnight + 12 * 60 * 60 * 1000));
  const offset = offsetParts.find(({ type }) => type === "timeZoneName")?.value;
  const offsetMatch = offset?.match(/^GMT([+-])(\d{2}):(\d{2})$/);
  const offsetMinutes = offsetMatch
    ? (offsetMatch[1] === "+" ? 1 : -1) *
      (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]))
    : 0;

  return { dayKey, start: utcMidnight - offsetMinutes * 60_000 };
}

async function fetchPubgJson(path: string, apiKey: string): Promise<unknown> {
  const response = await fetch(`https://api.pubg.com${path}`, {
    headers: {
      Accept: "application/vnd.api+json",
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    console.error("PUBG API request failed:", response.status);
    throw new Error(`PUBG API request failed (${response.status}).`);
  }
  return response.json();
}

async function loadPubgDailyStats(
  playerName: string,
  dayKey: string,
): Promise<PubgDailyStats> {
  const apiKey = process.env.PUBG_API_KEY;
  if (!apiKey) throw new Error("Missing PUBG API key.");

  const dayStart = getPragueDayStart(new Date(`${dayKey}T12:00:00Z`)).start;
  const playerUrl = new URL("https://api.pubg.com/shards/steam/players");
  playerUrl.searchParams.set("filter[playerNames]", playerName);
  const playerResponse = await fetchPubgJson(
    `${playerUrl.pathname}${playerUrl.search}`,
    apiKey,
  );
  if (!isRecord(playerResponse) || !Array.isArray(playerResponse.data)) {
    throw new Error("PUBG returned an invalid player response.");
  }

  const player = playerResponse.data.find(
    (candidate) =>
      isRecord(candidate) &&
      isRecord(candidate.attributes) &&
      typeof candidate.attributes.name === "string" &&
      candidate.attributes.name.toLocaleLowerCase("en-US") ===
        playerName.toLocaleLowerCase("en-US"),
  );
  if (!isRecord(player) || typeof player.id !== "string") {
    throw new Error("PUBG player was not found.");
  }

  const relationships = isRecord(player.relationships)
    ? player.relationships
    : null;
  const matchesRelationship = isRecord(relationships?.matches)
    ? relationships.matches
    : null;
  const matchData = Array.isArray(matchesRelationship?.data)
    ? matchesRelationship.data
    : [];
  const matchIds = matchData.flatMap((match) =>
    isRecord(match) && typeof match.id === "string" ? [match.id] : [],
  );

  const results = await Promise.all(
    matchIds.map(async (matchId): Promise<RankedMatchStats | null> => {
      const match = await fetchPubgJson(
        `/shards/steam/matches/${encodeURIComponent(matchId)}`,
        apiKey,
      );
      if (!isRecord(match) || !isRecord(match.data)) {
        throw new Error("PUBG returned an invalid match response.");
      }
      const attributes = isRecord(match.data.attributes)
        ? match.data.attributes
        : null;
      const createdAt =
        typeof attributes?.createdAt === "string"
          ? Date.parse(attributes.createdAt)
          : Number.NaN;
      const gameMode =
        typeof attributes?.gameMode === "string" ? attributes.gameMode : "";
      if (
        !Number.isFinite(createdAt) ||
        createdAt < dayStart ||
        !/^ranked(?:-|$)/i.test(gameMode)
      ) {
        return null;
      }

      const included = Array.isArray(match.included) ? match.included : [];
      const participant = included.find(
        (item) =>
          isRecord(item) &&
          item.type === "participant" &&
          isRecord(item.attributes) &&
          isRecord(item.attributes.stats) &&
          item.attributes.stats.playerId === player.id,
      );
      const stats =
        isRecord(participant) &&
        isRecord(participant.attributes) &&
        isRecord(participant.attributes.stats)
          ? participant.attributes.stats
          : null;
      return stats ? { stats, createdAt } : null;
    }),
  );

  const rankedToday = results
    .filter((match): match is RankedMatchStats => match !== null)
    .sort((left, right) => left.createdAt - right.createdAt);
  const totalKills = rankedToday.reduce(
    (total, { stats }) => total + readStat(stats, "kills"),
    0,
  );
  const totalDeaths = rankedToday.reduce((total, { stats }) => {
    if (typeof stats.deaths === "number" && Number.isFinite(stats.deaths)) {
      return total + stats.deaths;
    }
    return total + (stats.deathType === "alive" ? 0 : 1);
  }, 0);
  const totalDamage = rankedToday.reduce(
    (total, { stats }) => total + readStat(stats, "damageDealt"),
    0,
  );
  const totalHeadshotKills = rankedToday.reduce(
    (total, { stats }) => total + readStat(stats, "headshotKills"),
    0,
  );

  return {
    player: playerName,
    matches: rankedToday.length,
    kills: totalKills,
    deaths: totalDeaths,
    kd: totalDeaths > 0 ? totalKills / totalDeaths : null,
    longestKill: Math.round(
      Math.max(0, ...rankedToday.map(({ stats }) => readStat(stats, "longestKill"))) * 10,
    ) / 10,
    headshotRate: totalKills > 0 ? (totalHeadshotKills / totalKills) * 100 : 0,
    mostDamage: Math.round(
      Math.max(0, ...rankedToday.map(({ stats }) => readStat(stats, "damageDealt"))),
    ),
    averageDamage:
      rankedToday.length > 0
        ? Math.round((totalDamage / rankedToday.length) * 10) / 10
        : 0,
  };
}

const getCachedDailyStats = unstable_cache(
  loadPubgDailyStats,
  ["pubg-daily-ranked-stats-steam"],
  { revalidate: 300 },
);

export async function getProcessCachedPubgDailyStats(
  playerName: string,
): Promise<PubgDailyStats> {
  const { dayKey } = getPragueDayStart(new Date());
  const cacheKey = `${dayKey}:${playerName.toLocaleLowerCase("en-US")}`;
  const now = Date.now();

  for (const [key, entry] of processStatsCache) {
    if (entry.expiresAt <= now) processStatsCache.delete(key);
  }

  const cached = processStatsCache.get(cacheKey);
  if (cached) return cached.stats;

  const entry = {
    expiresAt: now + PROCESS_CACHE_TTL_MS,
    stats: loadPubgDailyStats(playerName, dayKey),
  };
  processStatsCache.set(cacheKey, entry);

  try {
    return await entry.stats;
  } catch (error) {
    if (processStatsCache.get(cacheKey) === entry) {
      processStatsCache.delete(cacheKey);
    }
    throw error;
  }
}

export async function getCachedPubgDailyStats(
  playerName: string,
): Promise<PubgDailyStats> {
  const { dayKey } = getPragueDayStart(new Date());
  return getCachedDailyStats(playerName, dayKey);
}
