import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { redeemCustomLedEffect, ShopActionError } from "@/lib/shop";

type EffectKeyframe = {
  time: number;
  color: string;
  opacity: number;
  animation: "steady" | "linear" | "ease-in" | "ease-out" | "ease-in-out" | "pulse" | "fill";
  ledIds: number[] | null;
};

const LED_COUNT = 333;
const MAX_DURATION_SECONDS = 10;
const FPS = 60;
const MAX_KEYFRAMES = MAX_DURATION_SECONDS * FPS;

function parseEffect(value: unknown): Prisma.InputJsonValue | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    value.name.trim().length < 1 ||
    value.name.trim().length > 40 ||
    !("durationSeconds" in value) ||
    typeof value.durationSeconds !== "number" ||
    !Number.isInteger(value.durationSeconds) ||
    value.durationSeconds < 1 ||
    value.durationSeconds > MAX_DURATION_SECONDS ||
    !("keyframes" in value) ||
    !Array.isArray(value.keyframes) ||
    value.keyframes.length < 2 ||
    value.keyframes.length > MAX_KEYFRAMES
  ) {
    return null;
  }

  const frames: EffectKeyframe[] = [];
  for (const frame of value.keyframes) {
    if (
      typeof frame !== "object" ||
      frame === null ||
      !("time" in frame) ||
      typeof frame.time !== "number" ||
      !Number.isInteger(frame.time) ||
      frame.time < 0 ||
      frame.time >= value.durationSeconds * FPS ||
      !("color" in frame) ||
      typeof frame.color !== "string" ||
      !/^#[0-9a-fA-F]{6}$/.test(frame.color) ||
      !("animation" in frame) ||
      (frame.animation !== "steady" &&
        frame.animation !== "linear" &&
        frame.animation !== "ease-in" &&
        frame.animation !== "ease-out" &&
        frame.animation !== "ease-in-out" &&
        frame.animation !== "pulse" &&
        frame.animation !== "fill") ||
      ("opacity" in frame &&
        (typeof frame.opacity !== "number" ||
          !Number.isFinite(frame.opacity) ||
          frame.opacity < 0 ||
          frame.opacity > 1)) ||
      ("ledIds" in frame &&
        frame.ledIds !== null &&
        (!Array.isArray(frame.ledIds) ||
          frame.ledIds.length < 1 ||
          frame.ledIds.length > LED_COUNT ||
          frame.ledIds.some(
            (ledId: unknown) =>
              typeof ledId !== "number" ||
              !Number.isInteger(ledId) ||
              ledId < 0 ||
              ledId >= LED_COUNT,
          ) ||
          new Set(frame.ledIds).size !== frame.ledIds.length))
    ) {
      return null;
    }
    frames.push({
      time: frame.time,
      color: frame.color,
      animation: frame.animation,
      opacity: "opacity" in frame ? frame.opacity as number : 1,
      ledIds:
        "ledIds" in frame && Array.isArray(frame.ledIds)
          ? frame.ledIds as number[]
          : null,
    });
  }
  if (
    frames.some((frame, index) => {
      if (index === 0) return false;
      for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
        const previous = frames[previousIndex];
        if (frame.time < previous.time) return true;
        if (frame.time > previous.time) break;
        if (frame.ledIds === null && previous.ledIds === null) return true;
        if (
          frame.ledIds !== null &&
          previous.ledIds !== null &&
          frame.ledIds.some((ledId) => previous.ledIds?.includes(ledId))
        ) {
          return true;
        }
      }
      return false;
    })
  ) {
    return null;
  }

  return {
    name: value.name.trim(),
    durationSeconds: value.durationSeconds,
    keyframes: frames,
  };
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 403 });
  }
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Přihlas se." }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data požadavku." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("effect" in body)) {
    return NextResponse.json({ error: "Chybí LED efekt." }, { status: 400 });
  }
  const effect = parseEffect(body.effect);
  if (!effect) {
    return NextResponse.json({ error: "LED efekt nebo jeho keyframes nejsou platné." }, { status: 400 });
  }

  try {
    const result = await redeemCustomLedEffect({ accountId: account.id, effect });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ShopActionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("LED effect redemption failed:", error);
    return NextResponse.json({ error: "LED efekt se nepodařilo uplatnit." }, { status: 500 });
  }
}
