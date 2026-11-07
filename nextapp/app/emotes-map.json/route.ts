import { prisma } from "@/lib/prisma";
import {
  EMOTE_GROUP,
  emoteCorsOptions,
  getOrBuildRepresentation,
  jsonResponse,
  serializeSortedObject,
  serviceUnavailableResponse,
  withEmoteCors,
} from "@/lib/emotes/public-json-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_KEY = "emotes-map";
const CACHE_TTL_MS = 30_000;
const CACHE_CONTROL = "public, max-age=30, s-maxage=30";

export function OPTIONS(request: Request): Response {
  return emoteCorsOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await getOrBuildRepresentation(
      CACHE_KEY,
      CACHE_TTL_MS,
      async () => {
        const now = new Date();
        const inventories = await prisma.blackMarketInventory.findMany({
          where: {
            item: { group: EMOTE_GROUP },
            OR: [{ expires_at: null }, { expires_at: { gt: now } }],
          },
          select: {
            account: {
              select: {
                identities: {
                  where: { provider: "twitch" },
                  select: {
                    provider_user_id: true,
                    display_name: true,
                  },
                },
              },
            },
            current_level: true,
            created_at: true,
            id: true,
            item: {
              select: {
                id: true,
                name: true,
                item_type: true,
                levels: {
                  select: { level: true, image_url: true },
                  orderBy: { level: "asc" },
                },
              },
            },
            use_input: true,
          },
          orderBy: [
            { account_id: "asc" },
            { created_at: "asc" },
            { id: "asc" },
          ],
        });

        const twitchUserIds = [
          ...new Set(
            inventories.flatMap((inventory) =>
              inventory.account.identities.map(
                (identity) => identity.provider_user_id,
              ),
            ),
          ),
        ];
        const twitchBalances = twitchUserIds.length
          ? await prisma.twitchCustomPointBalance.findMany({
              where: { twitch_user_id: { in: twitchUserIds } },
              select: {
                twitch_user_id: true,
                twitch_user_login: true,
              },
            })
          : [];
        const loginByTwitchId = new Map(
          twitchBalances.map((balance) => [
            balance.twitch_user_id,
            balance.twitch_user_login,
          ]),
        );

        const emotesByUsername = new Map<
          string,
          Array<{ id: string; t: string }>
        >();
        for (const inventory of inventories) {
          const identity = inventory.account.identities[0];
          if (!identity) continue;

          const username = (
            loginByTwitchId.get(identity.provider_user_id) ??
            identity.display_name
          )
            .trim()
            .toLowerCase();
          if (!username) continue;

          let emoteId = inventory.item.id;
          if (inventory.item.item_type === "progressive") {
            const level = getInventoryLevel(inventory);
            if (!level) continue;
            emoteId = `${inventory.item.id}_lvl${level.level}`;
          }

          const userEmotes = emotesByUsername.get(username) ?? [];
          userEmotes.push({
            id: emoteId,
            t: inventory.use_input ?? inventory.item.name,
          });
          emotesByUsername.set(username, userEmotes);
        }

        const entries: Array<[string, Array<{ id: string; t: string }>]> = [
          ...emotesByUsername.entries(),
        ].map(([username, emotes]) => [
          username,
          emotes.sort((left, right) =>
            left.id < right.id
              ? -1
              : left.id > right.id
                ? 1
                : left.t < right.t
                  ? -1
                  : left.t > right.t
                    ? 1
                    : 0,
          ),
        ]);
        return serializeSortedObject(entries);
      },
    );

    return withEmoteCors(
      jsonResponse(request, result.representation, result.status, CACHE_CONTROL),
      request,
    );
  } catch (error) {
    console.error("Failed to build emotes map:", error);
    return withEmoteCors(serviceUnavailableResponse(), request);
  }
}

function getInventoryLevel(inventory: {
  current_level: number;
  item: {
    id: string;
    levels: Array<{ level: number; image_url: string }>;
  };
}): { level: number; image_url: string } | undefined {
  let level = inventory.item.levels.find(
    (candidate) => candidate.level === inventory.current_level,
  );
  if (!level) {
    level = inventory.item.levels[0];
    if (!level) {
      console.warn(
        `Progressive item ${inventory.item.id} has no configured levels; skipping it.`,
      );
      return undefined;
    }
    console.warn(
      `Progressive item ${inventory.item.id} has no level ${inventory.current_level}; using level ${level.level}.`,
    );
  }
  return level;
}
