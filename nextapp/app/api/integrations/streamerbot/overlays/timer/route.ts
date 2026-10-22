import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import { publishStreamOverlayEvent } from "@/lib/stream-overlay-realtime";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    return NextResponse.json(
      { error: "Streamer.bot integrácia nie je nakonfigurovaná." },
      { status: 503 },
    );
  }
  if (authorization === "unauthorized") {
    return NextResponse.json({ error: "Neplatná autorizácia." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatné dáta požiadavky." }, { status: 400 });
  }

  if (
    !isRecord(body) ||
    typeof body.eventId !== "string" ||
    body.eventId.trim().length === 0 ||
    body.eventId.length > 180 ||
    typeof body.durationSeconds !== "number" ||
    !Number.isSafeInteger(body.durationSeconds) ||
    body.durationSeconds < 1 ||
    body.durationSeconds > 86_400 ||
    (body.title !== undefined &&
      (typeof body.title !== "string" ||
        body.title.trim().length === 0 ||
        body.title.length > 80))
  ) {
    return NextResponse.json({ error: "Neplatný časovač." }, { status: 400 });
  }

  try {
    const published = publishStreamOverlayEvent({
      type: "timer",
      eventId: body.eventId,
      durationSeconds: body.durationSeconds,
      startedAt: new Date().toISOString(),
      title: typeof body.title === "string" ? body.title.trim() : "COUNTDOWN",
    });
    return NextResponse.json(
      { ok: true, duplicate: !published },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Streamer.bot timer overlay publish failed:", error);
    return NextResponse.json(
      { error: "Časovač sa nepodarilo zobraziť." },
      { status: 503 },
    );
  }
}
