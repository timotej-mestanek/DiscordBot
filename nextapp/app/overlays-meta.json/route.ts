import { Prisma } from "@prisma/client";
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

const CACHE_KEY = "overlays-meta";
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
          where: {
            group: "overlay",
            overlay_config: { not: Prisma.DbNull },
          },
          select: {
            id: true,
            overlay_config: true,
          },
          orderBy: { id: "asc" },
        });

        const entries: Array<[string, unknown]> = items.flatMap((item) =>
          item.overlay_config === null
            ? []
            : [[item.id, item.overlay_config]],
        );
        return serializeSortedObject(entries);
      },
    );

    return withEmoteCors(
      jsonResponse(request, result.representation, result.status, CACHE_CONTROL),
      request,
    );
  } catch (error) {
    console.error("Failed to build overlays metadata:", error);
    return withEmoteCors(serviceUnavailableResponse(), request);
  }
}
