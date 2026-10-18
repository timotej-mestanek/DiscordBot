import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import { getCommunityLeaderboardSnapshot } from "@/lib/community-leaderboards";
import {
  isExtensionPubSubConfigurationError,
  publishExtensionBroadcast,
} from "@/lib/extensions/pubsub";
import { getCachedPubgDailyStats } from "@/lib/services/pubg";

type PublishRequest =
  | { type: "leaderboards" }
  | { type: "pubg"; player: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePublishRequest(value: unknown): PublishRequest | null {
  if (!isRecord(value)) return null;
  if (value.type === "leaderboards") {
    return { type: value.type };
  }
  if (
    value.type === "pubg" &&
    typeof value.player === "string" &&
    value.player.trim().length > 0 &&
    value.player.length <= 32 &&
    !/[^\p{L}\p{N}_-]/u.test(value.player)
  ) {
    return { type: "pubg", player: value.player.trim() };
  }
  return null;
}

async function getPubSubPayload(input: PublishRequest) {
  switch (input.type) {
    case "leaderboards":
      return {
        type: input.type,
        updatedAt: new Date().toISOString(),
        data: await getCommunityLeaderboardSnapshot(),
      };
    case "pubg":
      return {
        type: input.type,
        updatedAt: new Date().toISOString(),
        data: await getCachedPubgDailyStats(input.player),
      };
    default: {
      const exhaustive: never = input;
      return exhaustive;
    }
  }
}

export async function POST(request: Request) {
  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    console.error("Streamer.bot PubSub integration is not configured.");
    return NextResponse.json(
      { error: "Integrace není nakonfigurovaná." },
      { status: 503 },
    );
  }
  if (authorization === "unauthorized") {
    return NextResponse.json({ error: "Neplatná autorizace." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data požadavku." }, { status: 400 });
  }
  const input = parsePublishRequest(body);
  if (!input) {
    return NextResponse.json(
      { error: "Neplatný typ Twitch Extension PubSub zprávy." },
      { status: 400 },
    );
  }

  try {
    const payload = await getPubSubPayload(input);
    await publishExtensionBroadcast(payload, "gamestats");
    return NextResponse.json({ ok: true, type: input.type });
  } catch (error) {
    if (
      isExtensionPubSubConfigurationError(error) ||
      (error instanceof Error &&
        error.message === "Twitch Extension secret must be base64-encoded.")
    ) {
      console.error("Twitch Extension PubSub configuration error:", error.message);
      return NextResponse.json(
        { error: "Twitch Extension PubSub není nakonfigurovaný." },
        { status: 503 },
      );
    }
    if (
      error instanceof Error &&
      error.message === "Twitch Extension PubSub message exceeds 5000 bytes."
    ) {
      return NextResponse.json({ error: error.message }, { status: 413 });
    }
    console.error("Twitch Extension PubSub request failed:", error);
    return NextResponse.json(
      { error: "Data se nepodařilo odeslat do Twitch Extension PubSub." },
      { status: 502 },
    );
  }
}
