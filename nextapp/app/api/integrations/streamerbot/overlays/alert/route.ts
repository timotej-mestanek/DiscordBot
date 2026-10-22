import { NextResponse } from "next/server";
import { authorizeStreamerBotRequest } from "@/lib/integrations/streamerbot";
import {
  publishStreamOverlayEvent,
  type StreamAlertSeverity,
} from "@/lib/stream-overlay-realtime";

function isSeverity(value: unknown): value is StreamAlertSeverity {
  return (
    value === "info" ||
    value === "attention" ||
    value === "warning" ||
    value === "critical"
  );
}

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
    typeof body.active !== "boolean"
  ) {
    return NextResponse.json({ error: "Neplatný alert." }, { status: 400 });
  }

  if (!body.active) {
    try {
      publishStreamOverlayEvent({
        type: "alert",
        eventId: body.eventId,
        active: false,
      });
      return NextResponse.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch (error) {
      console.error("Streamer.bot alert overlay publish failed:", error);
      return NextResponse.json(
        { error: "Alert sa nepodarilo skryť." },
        { status: 503 },
      );
    }
  }

  if (
    !isSeverity(body.severity) ||
    typeof body.title !== "string" ||
    body.title.trim().length === 0 ||
    body.title.length > 80 ||
    typeof body.message !== "string" ||
    body.message.trim().length === 0 ||
    body.message.length > 500
  ) {
    return NextResponse.json({ error: "Neplatný obsah alertu." }, { status: 400 });
  }

  try {
    publishStreamOverlayEvent({
      type: "alert",
      eventId: body.eventId,
      active: true,
      severity: body.severity,
      title: body.title.trim(),
      message: body.message.trim(),
    });
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Streamer.bot alert overlay publish failed:", error);
    return NextResponse.json(
      { error: "Alert sa nepodarilo zobraziť." },
      { status: 503 },
    );
  }
}
