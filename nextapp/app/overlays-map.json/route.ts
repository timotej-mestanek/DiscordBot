import { prisma } from "@/lib/prisma";
import {
  emoteCorsOptions,
  getOrBuildRepresentation,
  jsonResponse,
  serializeSortedObject,
  serviceUnavailableResponse,
  withEmoteCors,
} from "@/lib/emotes/public-json-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_KEY = "overlays-map";
const CACHE_TTL_MS = 30_000;
const CACHE_CONTROL = "public, max-age=30, s-maxage=30";
const OVERLAY_GROUP = "overlay";

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
            item: { group: OVERLAY_GROUP },
            is_equipped: true,
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
            item: { select: { id: true } },
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

        const overlaysByUsername = new Map<string, string>();
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

          const overlayId = `${inventory.item.id}_lvl${inventory.current_level}`;
          if (overlaysByUsername.has(username)) {
            console.warn(
              `Multiple equipped overlays found for ${username}; using the first inventory item.`,
            );
            continue;
          }
          overlaysByUsername.set(username, overlayId);
        }

        return serializeSortedObject([...overlaysByUsername.entries()]);
      },
    );

    return withEmoteCors(
      jsonResponse(request, result.representation, result.status, CACHE_CONTROL),
      request,
    );
  } catch (error) {
    console.error("Failed to build overlays map:", error);
    return withEmoteCors(serviceUnavailableResponse(), request);
  }
}
