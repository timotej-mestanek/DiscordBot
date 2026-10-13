import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { adjustPoints } from "@/lib/points";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";

export async function POST(request: Request) {
  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    console.error("Streamer.bot points integration is not configured.");
    return NextResponse.json({ error: "Integrace není nakonfigurovaná." }, { status: 503 });
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
  if (
    typeof body !== "object" ||
    body === null ||
    !("eventId" in body) ||
    !("twitchUserId" in body) ||
    !("delta" in body) ||
    typeof body.eventId !== "string" ||
    body.eventId.length < 1 ||
    body.eventId.length > 200 ||
    typeof body.twitchUserId !== "string" ||
    !/^\d{1,32}$/.test(body.twitchUserId) ||
    typeof body.delta !== "number" ||
    !Number.isSafeInteger(body.delta) ||
    body.delta === 0 ||
    Math.abs(body.delta) > 1_000_000_000
  ) {
    return NextResponse.json({ error: "Neplatná změna bodů." }, { status: 400 });
  }

  try {
    await adjustPoints({
      currency: "twitch_custom",
      providerUserId: body.twitchUserId,
      delta: body.delta,
      reason: "Streamer.bot point change",
      actorAccountId: null,
      sourceEventId: body.eventId,
    });
    return NextResponse.json({ ok: true, duplicate: false });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    if (error instanceof Error && error.name === "InsufficientPointsError") {
      return NextResponse.json({ error: "Zůstatek nemůže být záporný." }, { status: 409 });
    }
    console.error("Streamer.bot points update failed:", error);
    return NextResponse.json({ error: "Změnu bodů se nepodařilo uložit." }, { status: 500 });
  }
}
