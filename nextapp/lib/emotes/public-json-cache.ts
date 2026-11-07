import { createHash } from "node:crypto";

type JsonRepresentation = {
  body: string;
  etag: string;
  cachedAt: number;
};

type CacheResult = {
  representation: JsonRepresentation;
  status: "HIT" | "MISS";
};

type JsonCacheState = {
  cache: Map<string, JsonRepresentation>;
  inFlight: Map<string, Promise<JsonRepresentation>>;
  refreshTimers: Map<string, ReturnType<typeof setTimeout>>;
  generations: Map<string, number>;
};

const globalCache = globalThis as typeof globalThis & {
  __publicJsonCacheState?: JsonCacheState;
};
const cacheState = (globalCache.__publicJsonCacheState ??= {
  cache: new Map(),
  inFlight: new Map(),
  refreshTimers: new Map(),
  generations: new Map(),
});
const { cache, inFlight, refreshTimers, generations } = cacheState;

export const EMOTE_GROUP = "emote";
const ALLOWED_EMOTE_ORIGIN = "http://localhost:5173";

export function withEmoteCors(response: Response, request: Request): Response {
  const headers = new Headers(response.headers);
  
  const vary = new Set(
    (headers.get("Vary") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
  vary.add("Origin");
  headers.set("Vary", [...vary].join(", "));
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "If-None-Match");
  headers.set("Access-Control-Expose-Headers", "ETag");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export function emoteCorsOptions(request: Request): Response {
  const response = new Response(null, {
    status: 204,
    headers: {
      "Cache-Control": "no-store",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
    },
  });
  return withEmoteCors(response, request);
}

export function getCachedRepresentation(
  key: string,
): JsonRepresentation | undefined {
  return cache.get(key);
}

export async function getOrBuildRepresentation(
  key: string,
  ttlMs: number,
  buildBody: () => Promise<string>,
): Promise<CacheResult> {
  const cached = cache.get(key);
  const fresh =
    cached && Date.now() - cached.cachedAt < ttlMs ? cached : undefined;
  if (fresh) return { representation: fresh, status: "HIT" };

  let pending = inFlight.get(key);
  if (!pending) {
    const generation = generations.get(key) ?? 0;
    pending = buildBody().then((body) => {
      return storeRepresentation(key, body, generation);
    });
    inFlight.set(key, pending);
  }

  try {
    const representation = await pending;
    scheduleRepresentationRefresh(key, ttlMs, buildBody);
    return { representation, status: "MISS" };
  } finally {
    if (inFlight.get(key) === pending) inFlight.delete(key);
  }
}

export function invalidateCachedRepresentation(key: string): void {
  generations.set(key, (generations.get(key) ?? 0) + 1);
  cache.delete(key);
  inFlight.delete(key);
  const timer = refreshTimers.get(key);
  if (timer) clearTimeout(timer);
  refreshTimers.delete(key);
}

function storeRepresentation(
  key: string,
  body: string,
  generation: number,
): JsonRepresentation {
  const representation = {
    body,
    etag: `"${createHash("sha256").update(body).digest("hex")}"`,
    cachedAt: Date.now(),
  };
  if ((generations.get(key) ?? 0) === generation) {
    cache.set(key, representation);
  }
  return representation;
}

export function scheduleRepresentationRefresh(
  key: string,
  ttlMs: number,
  buildBody: () => Promise<string>,
): void {
  if (refreshTimers.has(key)) return;
  const timer = setTimeout(() => {
    refreshTimers.delete(key);
    if (inFlight.has(key)) {
      scheduleRepresentationRefresh(key, ttlMs, buildBody);
      return;
    }

    const generation = generations.get(key) ?? 0;
    const pending = buildBody()
      .then((body) => storeRepresentation(key, body, generation))
      .catch((error: unknown) => {
        if ((generations.get(key) ?? 0) === generation) cache.delete(key);
        console.error(`Background refresh failed for ${key}:`, error);
        throw error;
      });
    inFlight.set(key, pending);

    void pending
      .catch(() => undefined)
      .finally(() => {
        if (inFlight.get(key) === pending) inFlight.delete(key);
        scheduleRepresentationRefresh(key, ttlMs, buildBody);
      });
  }, Math.max(1_000, Math.floor(ttlMs * 0.9)));
  timer.unref?.();
  refreshTimers.set(key, timer);
}

export function matchesIfNoneMatch(
  requestHeader: string | null,
  etag: string,
): boolean {
  if (!requestHeader) return false;
  return requestHeader
    .split(",")
    .some((candidate) => candidate.trim() === "*" || candidate.trim() === etag);
}

export function serializeSortedObject(
  entries: Array<[string, unknown]>,
): string {
  entries.sort(([left], [right]) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  return `{${entries
    .map(([key, value]) => `${JSON.stringify(key)}:${JSON.stringify(value)}`)
    .join(",")}}`;
}

export function jsonResponse(
  request: Request,
  representation: JsonRepresentation,
  cacheStatus: "HIT" | "MISS",
  cacheControl: string,
  vary?: string,
): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": cacheControl,
    ETag: representation.etag,
    "X-Cache": cacheStatus,
  });
  if (vary) headers.set("Vary", vary);

  if (matchesIfNoneMatch(request.headers.get("if-none-match"), representation.etag)) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(representation.body, { status: 200, headers });
}

export function serviceUnavailableResponse(vary?: string): Response {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Cache": "MISS",
  });
  if (vary) headers.set("Vary", vary);

  return new Response('{"error":"Service unavailable"}', {
    status: 503,
    headers,
  });
}
