import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import {
  convertPoints,
  isSupportedPointCurrency,
  InsufficientPointsError,
} from "@/lib/points";

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 403 });
  }

  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Přihlas se." }, { status: 401 });
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
    !("source" in body) ||
    !("target" in body) ||
    !("sourceAmount" in body) ||
    !isSupportedPointCurrency(body.source) ||
    !isSupportedPointCurrency(body.target) ||
    typeof body.sourceAmount !== "number" ||
    !Number.isSafeInteger(body.sourceAmount) ||
    body.sourceAmount <= 0 ||
    body.sourceAmount > 1_000_000_000
  ) {
    return NextResponse.json({ error: "Neplatné údaje konverze." }, { status: 400 });
  }

  try {
    const result = await convertPoints({
      accountId: account.id,
      identities: account.identities,
      source: body.source,
      target: body.target,
      sourceAmount: body.sourceAmount,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof InsufficientPointsError) {
      return NextResponse.json({ error: "Nemáš dostatek bodů." }, { status: 409 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Point conversion failed:", error);
    return NextResponse.json({ error: "Konverze bodů selhala." }, { status: 500 });
  }
}
