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

const CACHE_KEY = "emotes-meta";
const CACHE_TTL_MS = 86_400_000;
const CACHE_CONTROL = "public, max-age=86400, s-maxage=86400";

export function OPTIONS(request: Request): Response {
  return emoteCorsOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const result = await getOrBuildRepresentation(
      CACHE_KEY,
      CACHE_TTL_MS,
      async () => {
        const items = await prisma.blackMarketItem.findMany({
          where: { group: EMOTE_GROUP },
          select: {
            id: true,
            image_url: true,
            item_type: true,
            levels: {
              select: { image_url: true, level: true },
              orderBy: { level: "asc" },
            },
          },
          orderBy: { id: "asc" },
        });

        const entries: Array<[string, { u: string }]> = [];
        for (const item of items) {
          if (item.item_type === "progressive") {
            for (const level of item.levels) {
              entries.push([
                `${item.id}_lvl${level.level}`,
                { u: level.image_url },
              ]);
            }
          } else if (item.image_url) {
            entries.push([item.id, { u: item.image_url }]);
          }
        }

        return serializeSortedObject(entries);
      },
    );

    return withEmoteCors(
      jsonResponse(
        request,
        result.representation,
        result.status,
        CACHE_CONTROL,
      ),
      request,
    );
  } catch (error) {
    console.error("Failed to build emotes metadata:", error);
    return withEmoteCors(serviceUnavailableResponse(), request);
  }
}
