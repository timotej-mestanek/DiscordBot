import { NextResponse } from "next/server";
import {
  isExtensionPubSubConfigured,
  isExtensionPubSubConfigurationError,
  publishExtensionBroadcast,
} from "@/lib/extensions/pubsub";

export const runtime = "nodejs";

const MIN_PUBLISH_INTERVAL_MS = 8_000;
let lastPublishAt = 0;

export async function POST() {
  if (!isExtensionPubSubConfigured("spotify")) {
    return NextResponse.json(
      { error: "Spotify Extension PubSub is not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const now = Date.now();
  const retryAfterMs = lastPublishAt + MIN_PUBLISH_INTERVAL_MS - now;
  if (retryAfterMs > 0) {
    return NextResponse.json(
      {
        error: "Test broadcasts are limited to one every 8 seconds.",
        retryAfterMs,
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(retryAfterMs / 1_000)),
        },
      },
    );
  }

  lastPublishAt = now;
  try {
    await publishExtensionBroadcast(
      {
        type: "spotify",
        updatedAt: new Date(now).toISOString(),
        isLive: true,
        testMode: true,
        data: {
          is_playing: true,
          item: {
            name: "Spotify Extension Test Track",
            artists: [{ name: "Sample Artist" }],
          },
        },
      },
      "spotify",
    );
  } catch (error) {
    lastPublishAt = 0;
    if (
      isExtensionPubSubConfigurationError(error) ||
      (error instanceof Error &&
        error.message === "Twitch Extension secret must be base64-encoded.")
    ) {
      console.error("Spotify test broadcast configuration error:", error);
      return NextResponse.json(
        { error: "Spotify Extension PubSub is not configured correctly." },
        { status: 503, headers: { "Cache-Control": "no-store" } },
      );
    }

    console.error("Spotify test broadcast failed:", error);
    return NextResponse.json(
      { error: "Could not send the Spotify test broadcast." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  return NextResponse.json(
    { ok: true, track: "Spotify Extension Test Track" },
    { headers: { "Cache-Control": "no-store" } },
  );
}
