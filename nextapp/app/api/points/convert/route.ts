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
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }

  const account = await getCurrentAccount();
  if (!account) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
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
    return NextResponse.json({ error: "Invalid conversion details." }, { status: 400 });
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
      return NextResponse.json({ error: "You do not have enough points." }, { status: 409 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Point conversion failed:", error);
    return NextResponse.json({ error: "Point conversion failed." }, { status: 500 });
  }
}
