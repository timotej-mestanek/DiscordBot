import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import {
  publishStreamOverlayEvent,
  type StreamVotingOption,
} from "@/lib/stream-overlay-realtime";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOptions(value: unknown): StreamVotingOption[] | null {
  if (!Array.isArray(value) || value.length > 8) return null;
  const options: StreamVotingOption[] = [];
  const ids = new Set<string>();
  for (const option of value) {
    if (
      !isRecord(option) ||
      typeof option.id !== "string" ||
      !/^[a-zA-Z0-9_-]{1,40}$/.test(option.id) ||
      ids.has(option.id) ||
      typeof option.label !== "string" ||
      option.label.trim().length === 0 ||
      option.label.length > 80 ||
      typeof option.votes !== "number" ||
      !Number.isSafeInteger(option.votes) ||
      option.votes < 0 ||
      option.votes > 1_000_000_000
    ) {
      return null;
    }
    ids.add(option.id);
    options.push({
      id: option.id,
      label: option.label.trim(),
      votes: option.votes,
    });
  }
  return options;
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
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Neplatné hlasovanie." }, { status: 400 });
  }

  const options = parseOptions(body.options);
  if (
    typeof body.eventId !== "string" ||
    body.eventId.trim().length === 0 ||
    body.eventId.length > 180 ||
    typeof body.active !== "boolean" ||
    typeof body.question !== "string" ||
    body.question.trim().length === 0 ||
    body.question.length > 120 ||
    options === null ||
    (body.active && options.length < 2)
  ) {
    return NextResponse.json({ error: "Neplatné hlasovanie." }, { status: 400 });
  }

  try {
    publishStreamOverlayEvent({
      type: "voting",
      eventId: body.eventId,
      active: body.active,
      question: body.question.trim(),
      options,
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Streamer.bot voting overlay publish failed:", error);
    return NextResponse.json(
      { error: "Hlasovanie sa nepodarilo zobraziť." },
      { status: 503 },
    );
  }
}
