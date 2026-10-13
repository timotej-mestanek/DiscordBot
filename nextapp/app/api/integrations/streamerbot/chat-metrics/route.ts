import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import { prisma } from "@/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= 1_000_000
  );
}

export async function POST(request: Request) {
  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    console.error("Streamer.bot chat metrics integration is not configured.");
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
  if (
    !isRecord(body) ||
    typeof body.eventId !== "string" ||
    body.eventId.trim().length < 1 ||
    body.eventId.length > 200 ||
    (body.platform !== "twitch" && body.platform !== "discord") ||
    typeof body.userId !== "string" ||
    !/^\d{1,32}$/.test(body.userId) ||
    typeof body.displayName !== "string" ||
    body.displayName.trim().length < 1 ||
    body.displayName.length > 80 ||
    !validCount(body.profanityCount) ||
    !validCount(body.messageCount) ||
    (body.profanityCount === 0 && body.messageCount === 0)
  ) {
    return NextResponse.json({ error: "Neplatné chat statistiky." }, { status: 400 });
  }

  try {
    await prisma.streamerBotChatMetricEvent.create({
      data: {
        source_event_id: body.eventId,
        platform: body.platform,
        provider_user_id: body.userId,
        display_name: body.displayName.trim(),
        profanity_count: body.profanityCount,
        message_count: body.messageCount,
      },
    });
    return NextResponse.json({ ok: true, duplicate: false });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    console.error("Streamer.bot chat metrics ingest failed:", error);
    return NextResponse.json(
      { error: "Chat statistiky se nepodařilo uložit." },
      { status: 500 },
    );
  }
}
