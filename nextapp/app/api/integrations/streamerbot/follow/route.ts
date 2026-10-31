import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import { prisma } from "@/lib/prisma";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(request: Request) {
  const authorization = authorizeStreamerBotRequest(request);
  if (authorization === "unconfigured") {
    console.error("Streamer.bot follow integration is not configured.");
    return NextResponse.json(
      { error: "Streamer.bot integration is not configured." },
      { status: 503 },
    );
  }
  if (authorization === "unauthorized") {
    return NextResponse.json({ error: "Invalid authorization." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }
  if (
    !isRecord(body) ||
    typeof body.eventId !== "string" ||
    body.eventId.trim().length < 1 ||
    body.eventId.length > 200 ||
    typeof body.userId !== "string" ||
    !/^\d{1,32}$/u.test(body.userId) ||
    typeof body.displayName !== "string" ||
    body.displayName.trim().length < 1 ||
    body.displayName.length > 80 ||
    /[\u0000-\u001f\u007f]/u.test(body.displayName)
  ) {
    return NextResponse.json({ error: "Invalid Twitch follow event." }, { status: 400 });
  }

  try {
    await prisma.streamerBotTwitchFollowEvent.create({
      data: {
        source_event_id: body.eventId.trim(),
        twitch_user_id: body.userId,
        display_name: body.displayName.trim(),
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
    console.error("Streamer.bot Twitch follow ingest failed:", error);
    return NextResponse.json(
      { error: "The Twitch follow event could not be stored." },
      { status: 500 },
    );
  }
}
