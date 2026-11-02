import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import {
  changePointBalance,
  InsufficientPointsError,
  isSupportedPointCurrency,
} from "@/lib/points";

type Provider = "discord" | "twitch";
type UserRow = {
  key: string;
  displayName: string;
  accountId: string | null;
  isTwitchFollower: boolean;
  goldenEggs: number | null;
  discord: { id: string; name: string; points: number } | null;
  twitch: { id: string; name: string; points: number } | null;
  shopInventory: Array<{ productId: string; name: string; quantity: number }>;
  blackMarketInventory: Array<{
    itemId: string;
    name: string;
    level: number;
    group: string;
    equipped: boolean;
  }>;
  crateInventory: Array<{ crateId: string; name: string; quantity: number }>;
  keyInventory: Array<{ crateId: string; name: string; quantity: number }>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

class InventoryAdjustmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InventoryAdjustmentError";
  }
}

export async function GET() {
  const admin = await getCurrentAccount();
  if (!admin) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const [
    accounts,
    discordEntities,
    twitchEntities,
    twitchBalances,
    chatGroups,
    followerGroups,
    shopProducts,
    blackMarketItems,
    crates,
  ] = await Promise.all([
    prisma.webAccount.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        display_name: true,
        golden_eggs: true,
        identities: {
          select: { provider: true, provider_user_id: true, display_name: true },
        },
        black_market_key_inventory: {
          where: { quantity: { gt: 0 } },
          select: {
            crate_id: true,
            quantity: true,
            crate: { select: { name: true } },
          },
        },
        shop_inventory: {
          where: { quantity: { gt: 0 } },
          select: {
            product_id: true,
            quantity: true,
            product: { select: { name: true } },
          },
        },
        black_market_inventory: {
          where: {
            OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
          },
          select: {
            item_id: true,
            current_level: true,
            group: true,
            is_equipped: true,
            item: { select: { name: true } },
          },
        },
        black_market_crate_inventory: {
          where: { quantity: { gt: 0 } },
          select: {
            crate_id: true,
            quantity: true,
            crate: { select: { name: true } },
          },
        },
      },
    }),
    prisma.discordEntity.findMany({
      select: { discord_id: true, name: true, points: true },
    }),
    prisma.twitchEntity.findMany({
      select: { twitch_id: true, name: true },
    }),
    prisma.twitchCustomPointBalance.findMany({
      select: { twitch_user_id: true, twitch_user_login: true, points: true },
    }),
    prisma.streamerBotChatMetricEvent.groupBy({
      by: ["platform", "provider_user_id", "display_name"],
      where: { message_count: { gt: 0 } },
      _sum: { message_count: true },
      _max: { created_at: true },
      orderBy: { _max: { created_at: "desc" } },
    }),
    prisma.streamerBotTwitchFollowEvent.groupBy({
      by: ["twitch_user_id", "display_name"],
      _max: { created_at: true },
      orderBy: { _max: { created_at: "desc" } },
    }),
    prisma.shopProduct.findMany({
      orderBy: { name: "asc" },
      where: { product_type: "standard" },
      select: { id: true, name: true },
    }),
    prisma.blackMarketItem.findMany({
      where: { item_type: { not: "golden_eggs" } },
      orderBy: { id: "asc" },
      select: { id: true, name: true, group: true },
    }),
    prisma.blackMarketCrate.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, requires_key: true },
    }),
  ]);

  const users = new Map<string, UserRow>();
  const identityAccounts = new Map<string, string>();
  for (const account of accounts) {
    users.set(account.id, {
      key: account.id,
      displayName: account.display_name,
      accountId: account.id,
      isTwitchFollower: false,
      goldenEggs: account.golden_eggs,
      discord: null,
      twitch: null,
      shopInventory: account.shop_inventory.map((item) => ({
        productId: item.product_id,
        name: item.product.name,
        quantity: item.quantity,
      })),
      keyInventory: account.black_market_key_inventory.map((key) => ({
        crateId: key.crate_id,
        name: key.crate.name,
        quantity: key.quantity,
      })),
      blackMarketInventory: account.black_market_inventory.map((item) => ({
        itemId: item.item_id,
        name: item.item.name,
        level: item.current_level,
        group: item.group,
        equipped: item.is_equipped,
      })),
      crateInventory: account.black_market_crate_inventory.map((crate) => ({
        crateId: crate.crate_id,
        name: crate.crate.name,
        quantity: crate.quantity,
      })),
    });
    for (const identity of account.identities) {
      if (identity.provider === "discord" || identity.provider === "twitch") {
        identityAccounts.set(`${identity.provider}:${identity.provider_user_id}`, account.id);
        const row = users.get(account.id)!;
        row[identity.provider] = {
          id: identity.provider_user_id,
          name: identity.display_name,
          points: 0,
        };
      }
    }
  }

  const addIdentity = (
    provider: Provider,
    id: string,
    name: string,
    points?: number,
  ) => {
    const accountId = identityAccounts.get(`${provider}:${id}`);
    const key = accountId ?? `${provider}:${id}`;
    let row = users.get(key);
    if (!row) {
      row = {
        key,
        displayName: name || id,
        accountId: null,
        isTwitchFollower: false,
        goldenEggs: null,
        discord: null,
        twitch: null,
        shopInventory: [],
        blackMarketInventory: [],
        crateInventory: [],
        keyInventory: [],
      };
      users.set(key, row);
    }
    const previousIdentity = row[provider];
    row[provider] = {
      id,
      name: name || previousIdentity?.name || id,
      points: points ?? previousIdentity?.points ?? 0,
    };
    if (row.accountId === null && (!row.displayName || row.displayName === id)) {
      row.displayName = name || id;
    }
    return row;
  };

  for (const entity of discordEntities) {
    addIdentity("discord", entity.discord_id, entity.name, entity.points);
  }
  const twitchPoints = new Map(
    twitchBalances.map((balance) => [balance.twitch_user_id, balance]),
  );
  for (const entity of twitchEntities) {
    const balance = twitchPoints.get(entity.twitch_id);
    addIdentity("twitch", entity.twitch_id, entity.name, balance?.points ?? 0);
  }
  for (const balance of twitchBalances) {
    addIdentity(
      "twitch",
      balance.twitch_user_id,
      balance.twitch_user_login ?? balance.twitch_user_id,
      balance.points,
    );
  }
  const seenChatIdentities = new Set<string>();
  for (const group of chatGroups) {
    const identityKey = `${group.platform}:${group.provider_user_id}`;
    if (seenChatIdentities.has(identityKey)) continue;
    seenChatIdentities.add(identityKey);
    addIdentity(group.platform, group.provider_user_id, group.display_name);
  }
  const seenFollowerIds = new Set<string>();
  for (const follower of followerGroups) {
    if (seenFollowerIds.has(follower.twitch_user_id)) continue;
    seenFollowerIds.add(follower.twitch_user_id);
    addIdentity("twitch", follower.twitch_user_id, follower.display_name).isTwitchFollower = true;
  }

  return NextResponse.json({
    users: [...users.values()].sort((a, b) =>
      a.displayName.localeCompare(b.displayName),
    ),
    shopProducts,
    blackMarketItems,
    crates: crates.map((crate) => ({
      id: crate.id,
      name: crate.name,
      requiresKey: crate.requires_key,
    })),
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Invalid request." }, { status: 403 });
  }
  const admin = await getCurrentAccount();
  if (!admin) {
    return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  }
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Invalid request data." }, { status: 400 });
  }

  try {
    if (
      body.action === "adjust-points" &&
      isSupportedPointCurrency(body.currency) &&
      typeof body.providerUserId === "string" &&
      body.providerUserId.length > 0 &&
      body.providerUserId.length <= 255 &&
      typeof body.delta === "number" &&
      Number.isSafeInteger(body.delta) &&
      body.delta !== 0 &&
      Math.abs(body.delta) <= 1_000_000_000 &&
      typeof body.reason === "string" &&
      body.reason.trim().length > 0 &&
      body.reason.trim().length <= 500
    ) {
      const provider: Provider = body.currency === "discord" ? "discord" : "twitch";
      const linkedIdentity = await prisma.oAuthIdentity.findUnique({
        where: {
          provider_provider_user_id: {
            provider,
            provider_user_id: body.providerUserId,
          },
        },
        select: { account_id: true },
      });
      const currency = body.currency;
      const providerUserId = body.providerUserId;
      const delta = body.delta;
      const reason = body.reason.trim();
      await prisma.$transaction(async (transaction) => {
        await changePointBalance(
          transaction,
          currency,
          providerUserId,
          delta,
          reason,
          admin.id,
        );
        await transaction.adminAuditLog.create({
          data: {
            actor_account_id: admin.id,
            target_account_id: linkedIdentity?.account_id ?? null,
            action: "points.adjusted",
            details: {
              currency,
              providerUserId,
              delta,
              reason,
            },
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (
      (body.action === "shop-item" ||
        body.action === "crate-item" ||
        body.action === "crate-key") &&
      typeof body.accountId === "string" &&
      typeof body.itemId === "string" &&
      (body.operation === "add" || body.operation === "remove")
    ) {
      const accountId = body.accountId;
      const itemId = body.itemId;
      const operation = body.operation;
      const isShop = body.action === "shop-item";
      const isKey = body.action === "crate-key";
      await prisma.$transaction(async (transaction) => {
        if (!(await transaction.webAccount.findUnique({ where: { id: accountId }, select: { id: true } }))) {
          throw new InventoryAdjustmentError("Account not found.");
        }
        if (isShop) {
          if (!(await transaction.shopProduct.findUnique({ where: { id: itemId }, select: { id: true } }))) {
            throw new InventoryAdjustmentError("Shop item not found.");
          }
          if (operation === "add") {
            await transaction.shopInventory.upsert({
              where: {
                account_id_product_id: {
                  account_id: accountId,
                  product_id: itemId,
                },
              },
              create: {
                account_id: accountId,
                product_id: itemId,
                quantity: 1,
              },
              update: { quantity: { increment: 1 } },
            });
          } else {
            const result = await transaction.shopInventory.updateMany({
              where: {
                account_id: accountId,
                product_id: itemId,
                quantity: { gt: 0 },
              },
              data: { quantity: { decrement: 1 } },
            });
            if (result.count !== 1) throw new InventoryAdjustmentError("This user does not own that item.");
          }
        } else {
          const crate = await transaction.blackMarketCrate.findUnique({
            where: { id: itemId },
            select: { id: true, requires_key: true },
          });
          if (!crate) {
            throw new InventoryAdjustmentError("Crate not found.");
          }
          if (isKey && !crate.requires_key) {
            throw new InventoryAdjustmentError("This crate does not use keys.");
          }
          if (isKey && operation === "add") {
            await transaction.blackMarketKeyInventory.upsert({
              where: {
                account_id_crate_id: { account_id: accountId, crate_id: itemId },
              },
              create: { account_id: accountId, crate_id: itemId, quantity: 1 },
              update: { quantity: { increment: 1 } },
            });
          } else if (isKey) {
            const result = await transaction.blackMarketKeyInventory.updateMany({
              where: {
                account_id: accountId,
                crate_id: itemId,
                quantity: { gt: 0 },
              },
              data: { quantity: { decrement: 1 } },
            });
            if (result.count !== 1) throw new InventoryAdjustmentError("This user does not own that key.");
          } else if (operation === "add") {
            await transaction.blackMarketCrateInventory.upsert({
              where: {
                account_id_crate_id: {
                  account_id: accountId,
                  crate_id: itemId,
                },
              },
              create: {
                account_id: accountId,
                crate_id: itemId,
                quantity: 1,
              },
              update: { quantity: { increment: 1 } },
            });
          } else {
            const result = await transaction.blackMarketCrateInventory.updateMany({
              where: {
                account_id: accountId,
                crate_id: itemId,
                quantity: { gt: 0 },
              },
              data: { quantity: { decrement: 1 } },
            });
            if (result.count !== 1) throw new InventoryAdjustmentError("This user does not own that crate.");
          }
        }
        await transaction.adminAuditLog.create({
          data: {
            actor_account_id: admin.id,
            target_account_id: accountId,
            action: isShop
              ? "users.shop_inventory_adjusted"
              : isKey
                ? "users.crate_key_inventory_adjusted"
                : "users.crate_inventory_adjusted",
            details: {
              itemId,
              operation,
              inventoryType: isShop ? "shop" : isKey ? "key" : "crate",
            },
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (
      body.action === "black-market-item" &&
      typeof body.accountId === "string" &&
      typeof body.itemId === "string" &&
      (body.operation === "add" || body.operation === "remove")
    ) {
      const accountId = body.accountId;
      const itemId = body.itemId;
      const operation = body.operation;
      await prisma.$transaction(async (transaction) => {
        if (!(await transaction.webAccount.findUnique({ where: { id: accountId }, select: { id: true } }))) {
          throw new InventoryAdjustmentError("Account not found.");
        }
        const item = await transaction.blackMarketItem.findUnique({
          where: { id: itemId },
          select: { id: true, group: true, item_type: true },
        });
        if (!item) throw new InventoryAdjustmentError("Black Market item not found.");
        if (item.item_type === "golden_eggs") {
          throw new InventoryAdjustmentError("Golden Eggs are currency, not an inventory item.");
        }

        if (operation === "add") {
          const existing = await transaction.blackMarketInventory.findUnique({
            where: { account_id_item_id: { account_id: accountId, item_id: item.id } },
            select: { expires_at: true },
          });
          if (existing && (!existing.expires_at || existing.expires_at > new Date())) {
            throw new InventoryAdjustmentError("This user already owns that item.");
          }
          if (existing) {
            await transaction.blackMarketInventory.update({
              where: { account_id_item_id: { account_id: accountId, item_id: item.id } },
              data: {
                group: item.group,
                current_level: 1,
                is_equipped: false,
                expires_at: null,
              },
            });
          } else {
            await transaction.blackMarketInventory.create({
              data: {
                account_id: accountId,
                item_id: item.id,
                group: item.group,
              },
            });
          }
        } else {
          const result = await transaction.blackMarketInventory.deleteMany({
            where: {
              account_id: accountId,
              item_id: item.id,
            },
          });
          if (result.count !== 1) throw new InventoryAdjustmentError("This user does not own that item.");
        }
        await transaction.adminAuditLog.create({
          data: {
            actor_account_id: admin.id,
            target_account_id: accountId,
            action: "users.black_market_inventory_adjusted",
            details: { itemId: item.id, operation },
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action or data." }, { status: 400 });
  } catch (error) {
    if (error instanceof InsufficientPointsError) {
      return NextResponse.json({ error: "The balance cannot be negative." }, { status: 409 });
    }
    if (error instanceof InventoryAdjustmentError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message.endsWith("not found.") ? 404 : 409 },
      );
    }
    if (error instanceof Error && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "This user already owns that item." }, { status: 409 });
    }
    console.error("Admin user management action failed:", error);
    return NextResponse.json({ error: "The admin action failed." }, { status: 500 });
  }
}
