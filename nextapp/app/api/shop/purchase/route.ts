import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { isSupportedPointCurrency, InsufficientPointsError } from "@/lib/points";
import { purchaseCustomLedEffect, ShopActionError } from "@/lib/shop";

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
  if (
    typeof body !== "object" ||
    body === null ||
    !("currency" in body) ||
    !isSupportedPointCurrency(body.currency) ||
    !("productId" in body) ||
    typeof body.productId !== "string" ||
    body.productId.length < 1 ||
    body.productId.length > 64
  ) {
    return NextResponse.json({ error: "Vyber platnou měnu." }, { status: 400 });
  }

  try {
    const result = await purchaseCustomLedEffect({
      accountId: account.id,
      identities: account.identities,
      currency: body.currency,
      productId: body.productId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof InsufficientPointsError) {
      return NextResponse.json({ error: "Nemáš dostatek bodů." }, { status: 409 });
    }
    if (error instanceof ShopActionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Shop purchase failed:", error);
    return NextResponse.json({ error: "Nákup se nepodařilo dokončit." }, { status: 500 });
  }
}
