import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { redeemCustomLedEffect, ShopActionError } from "@/lib/shop";

type EffectKeyframe = {
  time: number;
  color: string;
  animation: "steady" | "linear" | "pulse";
};

function parseEffect(value: unknown): Prisma.InputJsonValue | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    value.name.trim().length < 1 ||
    value.name.trim().length > 40 ||
    !("durationSeconds" in value) ||
    value.durationSeconds !== 2 ||
    !("keyframes" in value) ||
    !Array.isArray(value.keyframes) ||
    value.keyframes.length < 2 ||
    value.keyframes.length > 120
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
      frame.time > 119 ||
      !("color" in frame) ||
      typeof frame.color !== "string" ||
      !/^#[0-9a-fA-F]{6}$/.test(frame.color) ||
      !("animation" in frame) ||
      (frame.animation !== "steady" &&
        frame.animation !== "linear" &&
        frame.animation !== "pulse")
    ) {
      return null;
    }
    frames.push({
      time: frame.time,
      color: frame.color,
      animation: frame.animation,
    });
  }
  if (
    frames.some((frame, index) => index > 0 && frame.time <= frames[index - 1].time)
  ) {
    return null;
  }

  return {
    name: value.name.trim(),
    durationSeconds: 2,
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
