import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import { getAdminShopDeliveries } from "@/lib/shop-admin";

export async function GET() {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const [products, deliveries] = await Promise.all([
    prisma.shopProduct.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { inventory: true, redemptions: true } },
      },
    }),
    getAdminShopDeliveries(),
  ]);
  return NextResponse.json({ products, deliveries });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (account.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
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
    !("name" in body) ||
    typeof body.name !== "string" ||
    body.name.trim().length < 1 ||
    body.name.trim().length > 80 ||
    !("description" in body) ||
    typeof body.description !== "string" ||
    body.description.trim().length > 500 ||
    !("addToInventory" in body) ||
    typeof body.addToInventory !== "boolean" ||
    !("streamerbotAction" in body) ||
    typeof body.streamerbotAction !== "string" ||
    body.streamerbotAction.trim().length < 1 ||
    body.streamerbotAction.trim().length > 100 ||
    /[\u0000-\u001f\u007f]/u.test(body.streamerbotAction) ||
    !("discordPrice" in body) ||
    !(body.discordPrice === null || (
      typeof body.discordPrice === "number" &&
      Number.isSafeInteger(body.discordPrice) &&
      body.discordPrice > 0 &&
      body.discordPrice <= 1_000_000_000
    )) ||
    !("twitchPrice" in body) ||
    !(body.twitchPrice === null || (
      typeof body.twitchPrice === "number" &&
      Number.isSafeInteger(body.twitchPrice) &&
      body.twitchPrice > 0 &&
      body.twitchPrice <= 1_000_000_000
    )) ||
    (body.discordPrice === null && body.twitchPrice === null) ||
    !("active" in body) ||
    typeof body.active !== "boolean" ||
    ("productId" in body && typeof body.productId !== "string")
  ) {
    return NextResponse.json({ error: "Check the product name, description, and prices." }, { status: 400 });
  }

  const name = body.name.trim();
  const description = body.description.trim();
  const discordPrice = body.discordPrice;
  const twitchPrice = body.twitchPrice;
  const active = body.active;
  const addToInventory = body.addToInventory;
  const streamerbotAction = body.streamerbotAction.trim();
  const productId =
    "productId" in body && typeof body.productId === "string" ? body.productId : null;

  try {
    await prisma.$transaction(async (transaction) => {
      const previous = productId
        ? await transaction.shopProduct.findUnique({ where: { id: productId } })
        : null;
      if (productId && !previous) throw new Error("Product not found.");

      const savedProduct = productId
        ? await transaction.shopProduct.update({
            where: { id: productId },
            data: {
              name,
              description,
              discord_price: discordPrice,
              twitch_price: twitchPrice,
              active,
              add_to_inventory: addToInventory,
              streamerbot_action: streamerbotAction,
            },
          })
        : await transaction.shopProduct.create({
            data: {
              name,
              description,
              discord_price: discordPrice,
              twitch_price: twitchPrice,
              active,
              add_to_inventory: addToInventory,
              streamerbot_action: streamerbotAction,
            },
          });

      await transaction.adminAuditLog.create({
        data: {
          actor_account_id: account.id,
          action: productId ? "shop.product_updated" : "shop.product_created",
          details: {
            productId: savedProduct.id,
            before: previous
              ? {
                  name: previous.name,
                  description: previous.description,
                  discordPrice: previous.discord_price,
                  twitchPrice: previous.twitch_price,
                  active: previous.active,
                  addToInventory: previous.add_to_inventory,
                  streamerbotAction: previous.streamerbot_action,
                }
              : null,
            after: {
              name,
              description,
              discordPrice,
              twitchPrice,
              active,
              addToInventory,
              streamerbotAction,
            },
          },
        },
      });
      return savedProduct;
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Produkt nebyl nalezen.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Shop module save failed:", error);
    return NextResponse.json({ error: "Could not save the product." }, { status: 500 });
  }
}
