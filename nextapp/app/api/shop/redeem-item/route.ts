import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { redeemShopProduct, ShopActionError } from "@/lib/shop";

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
    !("productId" in body) ||
    typeof body.productId !== "string" ||
    body.productId.length < 1 ||
    body.productId.length > 64
  ) {
    return NextResponse.json({ error: "Select a valid product." }, { status: 400 });
  }

  try {
    const result = await redeemShopProduct({
      accountId: account.id,
      identities: account.identities,
      productId: body.productId,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ShopActionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error("Shop item redemption failed:", error);
    return NextResponse.json({ error: "Could not redeem the shop item." }, { status: 500 });
  }
}
