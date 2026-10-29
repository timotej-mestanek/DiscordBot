import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { getCurrentAccount } from "@/lib/auth/session";
import { isSameOriginRequest } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";
import {
  adjustPoints,
  changePointBalance,
  isSupportedPointCurrency,
} from "@/lib/points";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidPubgPlayerName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= 32 &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

class ShopRevertError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopRevertError";
  }
}

async function revertShopOperation(adminId: string, logId: string) {
  return prisma.$transaction(async (transaction) => {
    const original = await transaction.adminAuditLog.findUnique({
      where: { id: logId },
    });
    if (
      !original ||
      !original.action.startsWith("shop.") ||
      original.action === "shop.reverted"
    ) {
      throw new ShopRevertError("This shop operation cannot be reverted.");
    }
    const existingRevert = await transaction.adminAuditLog.findUnique({
      where: { reverted_log_id: original.id },
      select: { id: true },
    });
    if (existingRevert) throw new ShopRevertError("This shop operation has already been reverted.");

    const details = original.details;
    if (!isRecord(details)) throw new ShopRevertError("The shop operation record contains invalid data.");

    if (original.action === "shop.purchased") {
      if (
        typeof details.productId !== "string" ||
        !isSupportedPointCurrency(details.currency) ||
        typeof details.price !== "number" ||
        !Number.isSafeInteger(details.price) ||
        !original.target_account_id ||
        (details.addToInventory === false &&
          typeof details.redemptionId !== "string")
      ) {
        throw new ShopRevertError("The purchase record is missing data required for a revert.");
      }
      const providerUserId =
        typeof details.providerUserId === "string"
          ? details.providerUserId
          : (
              await transaction.oAuthIdentity.findUnique({
                where: {
                  account_id_provider: {
                    account_id: original.target_account_id,
                    provider:
                      details.currency === "discord" ? "discord" : "twitch",
                  },
                },
                select: { provider_user_id: true },
              })
            )?.provider_user_id;
      if (!providerUserId) {
        throw new ShopRevertError("The linked account required to revert this purchase is missing.");
      }
      const productId = details.productId;
      const redemptionId =
        typeof details.redemptionId === "string" ? details.redemptionId : null;
      const addToInventory = details.addToInventory !== false;
      if (!addToInventory && typeof details.deliveryEventId === "string") {
        const delivery = await transaction.shopDeliveryEvent.findUnique({
          where: { event_id: details.deliveryEventId },
          select: { attempts: true, delivered_at: true, cancelled_at: true },
        });
        if (delivery?.delivered_at || (delivery && delivery.attempts > 0)) {
          throw new ShopRevertError(
            "This item has already been sent to Streamer.bot and cannot be safely reverted.",
          );
        }
        if (delivery && !delivery.cancelled_at) {
          const cancelled = await transaction.shopDeliveryEvent.updateMany({
            where: {
              event_id: details.deliveryEventId,
              attempts: 0,
              delivered_at: null,
              cancelled_at: null,
            },
            data: { cancelled_at: new Date() },
          });
          if (cancelled.count !== 1) {
            throw new ShopRevertError(
              "The Streamer.bot event started delivery and cannot be safely reverted.",
            );
          }
        }
      }
      await changePointBalance(
        transaction,
        details.currency,
        providerUserId,
        details.price,
        "Shop purchase reversal",
        adminId,
      );

      if (addToInventory) {
        const removed = await transaction.shopInventory.updateMany({
          where: {
            account_id: original.target_account_id,
            product_id: productId,
            quantity: { gt: 0 },
          },
          data: { quantity: { decrement: 1 } },
        });
        if (removed.count !== 1) {
          throw new ShopRevertError("The purchased item cannot be removed from inventory.");
        }
      } else if (redemptionId) {
        await transaction.shopRedemption.delete({
          where: { id: redemptionId },
        });
      } else {
        throw new ShopRevertError("The instant purchase record is missing its redemption ID.");
      }
    } else if (original.action === "shop.redeemed") {
      if (
        typeof details.productId !== "string" ||
        typeof details.redemptionId !== "string" ||
        !original.target_account_id
      ) {
        throw new ShopRevertError("The redemption record is missing data required for a revert.");
      }
      const redemption = await transaction.shopRedemption.findUnique({
        where: { id: details.redemptionId },
        select: { id: true, product_id: true },
      });
      if (!redemption || redemption.product_id !== details.productId) {
        throw new ShopRevertError("The redeemed item cannot be restored.");
      }
      if (typeof details.deliveryEventId === "string") {
        const delivery = await transaction.shopDeliveryEvent.findUnique({
          where: { event_id: details.deliveryEventId },
          select: { attempts: true, delivered_at: true, cancelled_at: true },
        });
        if (delivery?.delivered_at || (delivery && delivery.attempts > 0)) {
          throw new ShopRevertError(
            "This item has already been sent to Streamer.bot and cannot be safely restored.",
          );
        }
        if (delivery && !delivery.cancelled_at) {
          const cancelled = await transaction.shopDeliveryEvent.updateMany({
            where: {
              event_id: details.deliveryEventId,
              attempts: 0,
              delivered_at: null,
              cancelled_at: null,
            },
            data: { cancelled_at: new Date() },
          });
          if (cancelled.count !== 1) {
            throw new ShopRevertError(
              "The Streamer.bot event started delivery and cannot be safely restored.",
            );
          }
        }
      }
      await transaction.shopInventory.upsert({
        where: {
          account_id_product_id: {
            account_id: original.target_account_id,
            product_id: details.productId,
          },
        },
        create: {
          account_id: original.target_account_id,
          product_id: details.productId,
          quantity: 1,
        },
        update: { quantity: { increment: 1 } },
      });
      await transaction.shopRedemption.delete({ where: { id: redemption.id } });
    } else if (
      original.action === "shop.product_created" ||
      original.action === "shop.product_updated"
    ) {
      if (typeof details.productId !== "string") {
        throw new ShopRevertError("The product record is missing an identifier.");
      }
      const product = await transaction.shopProduct.findUnique({
        where: { id: details.productId },
        select: { id: true },
      });
      if (!product) throw new ShopRevertError("Shop product not found.");
      if (original.action === "shop.product_created") {
        await transaction.shopProduct.update({
          where: { id: details.productId },
          data: { active: false },
        });
      } else {
        const previous = details.before;
        if (
          !isRecord(previous) ||
          typeof previous.name !== "string" ||
          typeof previous.description !== "string" ||
          !(previous.discordPrice === null || typeof previous.discordPrice === "number") ||
          !(previous.twitchPrice === null || typeof previous.twitchPrice === "number") ||
          typeof previous.active !== "boolean" ||
          typeof previous.addToInventory !== "boolean" ||
          (previous.streamerbotAction !== undefined &&
            typeof previous.streamerbotAction !== "string")
        ) {
          throw new ShopRevertError("The product's previous settings are missing.");
        }
        await transaction.shopProduct.update({
          where: { id: details.productId },
          data: {
            name: previous.name,
            description: previous.description,
            discord_price: previous.discordPrice,
            twitch_price: previous.twitchPrice,
            active: previous.active,
            add_to_inventory: previous.addToInventory,
            ...(typeof previous.streamerbotAction === "string"
              ? { streamerbot_action: previous.streamerbotAction }
              : {}),
          },
        });
      }
    } else {
      throw new ShopRevertError("This type of shop operation cannot be reverted yet.");
    }

    await transaction.adminAuditLog.create({
      data: {
        actor_account_id: adminId,
        target_account_id: original.target_account_id,
        reverted_log_id: original.id,
        action: "shop.reverted",
        details: { sourceLogId: original.id, sourceAction: original.action },
      },
    });
    return { ok: true };
  });
}

export async function GET() {
  const admin = await getCurrentAccount();
  if (!admin) return NextResponse.json({ error: "Sign in to continue." }, { status: 401 });
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Access denied." }, { status: 403 });
  }

  const [
    accounts,
    rates,
    logs,
    pointEvents,
    streamEvents,
    gameStatsSettings,
  ] = await Promise.all([
    prisma.webAccount.findMany({
      orderBy: { created_at: "desc" },
      select: {
        id: true,
        display_name: true,
        role: true,
        created_at: true,
        identities: {
          select: { provider: true, provider_user_id: true, display_name: true },
        },
      },
    }),
    prisma.pointConversionRate.findMany(),
    prisma.adminAuditLog.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
      include: {
        actor: { select: { display_name: true } },
        target: { select: { display_name: true } },
      },
    }),
    prisma.pointLedgerEntry.findMany({
      orderBy: { created_at: "desc" },
      take: 100,
      include: { actor: { select: { display_name: true } } },
    }),
    prisma.streamEvent.findMany({ orderBy: { starts_at: "asc" } }),
    prisma.streamOverlayIntegration.findUnique({
      where: { id: "streamer" },
      select: { pubg_player_name: true, pubg_teammates: true },
    }),
  ]);

  const pubgTeammates = gameStatsSettings?.pubg_teammates ?? [];
  if (
    !isValidPubgPlayerName(gameStatsSettings?.pubg_player_name ?? "N4JTIK") ||
    !Array.isArray(pubgTeammates) ||
    !pubgTeammates.every(isValidPubgPlayerName)
  ) {
    throw new Error("Stored PUBG teammate settings are invalid.");
  }

  return NextResponse.json({
    accounts,
    rates,
    logs,
    pointEvents,
    streamEvents,
    pubgPlayerName: gameStatsSettings?.pubg_player_name ?? "N4JTIK",
    pubgTeammates,
    selfAccountId: admin.id,
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
  if (typeof body !== "object" || body === null || !("action" in body)) {
    return NextResponse.json({ error: "An action is required." }, { status: 400 });
  }

  try {
    if (body.action === "gamestats-pubg") {
      if (
        !("playerName" in body) ||
        !isValidPubgPlayerName(body.playerName) ||
        !("teammates" in body) ||
        !Array.isArray(body.teammates) ||
        !body.teammates.every(isValidPubgPlayerName)
      ) {
        return NextResponse.json(
          { error: "Check the player names (maximum 32 characters)." },
          { status: 400 },
        );
      }
      if (body.teammates.length > 3) {
        return NextResponse.json(
          { error: "The PUBG roster can have no more than three teammates." },
          { status: 400 },
        );
      }

      const playerName = body.playerName;
      const teammates = body.teammates;
      const previousTeammates = (previous: { pubg_teammates: unknown } | null) =>
        Array.isArray(previous?.pubg_teammates)
          ? previous.pubg_teammates.filter(isValidPubgPlayerName)
          : [];
      const names = [playerName, ...teammates].map((name) =>
        name.toLocaleLowerCase("en-US"),
      );
      if (new Set(names).size !== names.length) {
        return NextResponse.json(
          {
            error:
              "Player names must be unique, with no more than three teammates.",
          },
          { status: 400 },
        );
      }

      await prisma.$transaction(async (transaction) => {
        const previous = await transaction.streamOverlayIntegration.findUnique({
          where: { id: "streamer" },
          select: { pubg_player_name: true, pubg_teammates: true },
        });
        await transaction.streamOverlayIntegration.upsert({
          where: { id: "streamer" },
          create: {
            id: "streamer",
            pubg_player_name: playerName,
            pubg_teammates: teammates,
          },
          update: {
            pubg_player_name: playerName,
            pubg_teammates: teammates,
          },
        });
        await transaction.adminAuditLog.create({
          data: {
            actor_account_id: admin.id,
            action: "gamestats.pubg_roster_updated",
            details: {
              previous: previous
                ? {
                    playerName: previous.pubg_player_name,
                    teammates: previousTeammates(previous),
                  }
                : { playerName: "N4JTIK", teammates: [] },
              playerName,
              teammates,
            },
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    if (
      body.action === "shop-revert" &&
      "logId" in body &&
      typeof body.logId === "string" &&
      body.logId.length > 0
    ) {
      await revertShopOperation(admin.id, body.logId);
      return NextResponse.json({ ok: true });
    }

    if (
      body.action === "stream-event-create" &&
      "title" in body &&
      typeof body.title === "string" &&
      body.title.trim().length > 0 &&
      body.title.trim().length <= 120 &&
      "startsAt" in body &&
      typeof body.startsAt === "string" &&
      "endsAt" in body &&
      (typeof body.endsAt === "string" || body.endsAt === null)
    ) {
      const startsAt = new Date(body.startsAt);
      const endsAt = body.endsAt ? new Date(body.endsAt) : null;
      if (
        Number.isNaN(startsAt.getTime()) ||
        (endsAt && (Number.isNaN(endsAt.getTime()) || endsAt <= startsAt))
      ) {
        return NextResponse.json(
          { error: "Check the stream start and end date and time." },
          { status: 400 },
        );
      }
      const title = body.title.trim();
      await prisma.$transaction(async (transaction) => {
        const created = await transaction.streamEvent.create({
          data: {
            title,
            starts_at: startsAt,
            ends_at: endsAt,
          },
        });
        await transaction.adminAuditLog.create({
          data: {
            actor_account_id: admin.id,
            action: "stream.schedule_created",
            details: { eventId: created.id, title: created.title, startsAt },
          },
        });
        return created;
      });
      return NextResponse.json({ ok: true });
    }

    if (
      body.action === "stream-event-delete" &&
      "eventId" in body &&
      typeof body.eventId === "string" &&
      body.eventId.length > 0
    ) {
      const event = await prisma.streamEvent.findUnique({
        where: { id: body.eventId },
        select: { id: true, title: true, starts_at: true },
      });
      if (!event) {
        return NextResponse.json({ error: "Stream event not found." }, { status: 404 });
      }
      await prisma.$transaction([
        prisma.streamEvent.delete({ where: { id: event.id } }),
        prisma.adminAuditLog.create({
          data: {
            actor_account_id: admin.id,
            action: "stream.schedule_deleted",
            details: { eventId: event.id, title: event.title, startsAt: event.starts_at },
          },
        }),
      ]);
      return NextResponse.json({ ok: true });
    }

    if (
      body.action === "role" &&
      "accountId" in body &&
      typeof body.accountId === "string" &&
      "role" in body &&
      (body.role === "admin" || body.role === "user")
    ) {
      const targetAccountId = body.accountId;
      const requestedRole = body.role;
      if (targetAccountId === admin.id) {
        return NextResponse.json(
          { error: "You cannot change your own role here." },
          { status: 400 },
        );
      }
      await prisma.$transaction(
        async (transaction) => {
          const target = await transaction.webAccount.findUnique({
            where: { id: targetAccountId },
            select: { id: true, role: true },
          });
          if (!target) throw new Error("Account not found.");
          if (target.role === "admin" && requestedRole === "user") {
            const adminCount = await transaction.webAccount.count({
              where: { role: "admin" },
            });
            if (adminCount <= 1) throw new Error("The last administrator cannot be removed.");
          }
          if (target.role === requestedRole) return;

          await transaction.webAccount.update({
            where: { id: target.id },
            data: { role: requestedRole },
          });
          await transaction.adminAuditLog.create({
            data: {
              actor_account_id: admin.id,
              target_account_id: target.id,
              action: requestedRole === "admin" ? "admin.granted" : "admin.revoked",
              details: { previousRole: target.role, role: requestedRole },
            },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return NextResponse.json({ ok: true });
    }

    if (
      body.action === "adjust" &&
      "accountId" in body &&
      typeof body.accountId === "string" &&
      "currency" in body &&
      isSupportedPointCurrency(body.currency) &&
      "delta" in body &&
      typeof body.delta === "number" &&
      Number.isSafeInteger(body.delta) &&
      body.delta !== 0 &&
      Math.abs(body.delta) <= 1_000_000_000 &&
      "reason" in body &&
      typeof body.reason === "string" &&
      body.reason.trim().length > 0 &&
      body.reason.trim().length <= 500
    ) {
      const provider = body.currency === "discord" ? "discord" : "twitch";
      const target = await prisma.webAccount.findUnique({
        where: { id: body.accountId },
        select: {
          id: true,
          identities: {
            where: { provider },
            select: { provider_user_id: true },
          },
        },
      });
      const identity = target?.identities[0];
      if (!target || !identity) {
        return NextResponse.json(
          { error: "The account does not have a matching linked identity." },
          { status: 400 },
        );
      }

      await adjustPoints({
        currency: body.currency,
        providerUserId: identity.provider_user_id,
        delta: body.delta,
        reason: body.reason.trim(),
        actorAccountId: admin.id,
        targetAccountId: target.id,
      });
      return NextResponse.json({ ok: true });
    }

    if (
      body.action === "rate" &&
      "source" in body &&
      isSupportedPointCurrency(body.source) &&
      "target" in body &&
      isSupportedPointCurrency(body.target) &&
      body.source !== body.target &&
      "sourceAmount" in body &&
      typeof body.sourceAmount === "number" &&
      Number.isSafeInteger(body.sourceAmount) &&
      body.sourceAmount > 0 &&
      body.sourceAmount <= 1_000_000_000 &&
      "targetAmount" in body &&
      typeof body.targetAmount === "number" &&
      Number.isSafeInteger(body.targetAmount) &&
      body.targetAmount > 0 &&
      body.targetAmount <= 1_000_000_000 &&
      "enabled" in body &&
      typeof body.enabled === "boolean"
    ) {
      const source = body.source;
      const target = body.target;
      const sourceAmount = body.sourceAmount;
      const targetAmount = body.targetAmount;
      const enabled = body.enabled;
      await prisma.$transaction(async (transaction) => {
        await transaction.pointConversionRate.upsert({
          where: {
            source_currency_target_currency: {
              source_currency: source,
              target_currency: target,
            },
          },
          create: {
            source_currency: source,
            target_currency: target,
            source_amount: sourceAmount,
            target_amount: targetAmount,
            enabled,
          },
          update: {
            source_amount: sourceAmount,
            target_amount: targetAmount,
            enabled,
          },
        });
        await transaction.adminAuditLog.create({
          data: {
            actor_account_id: admin.id,
            action: "points.conversion_rate_updated",
            details: {
              source,
              target,
              sourceAmount,
              targetAmount,
              enabled,
            },
          },
        });
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action or data." }, { status: 400 });
  } catch (error) {
    if (error instanceof ShopRevertError) {
      return NextResponse.json(
        { error: error.message },
        {
          status:
            error.message === "This shop operation cannot be reverted." ||
            error.message === "Shop product not found."
              ? 404
              : 409,
        },
      );
    }
    if (error instanceof Error) {
      if (error.message === "This shop operation cannot be reverted." || error.message === "Shop product not found.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (
        error.message === "This shop operation has already been reverted." ||
        error.message.includes("cannot") ||
        error.message.includes("missing") ||
        error.message.includes("not found")
      ) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This shop operation has already been reverted." },
        { status: 409 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "The last administrator cannot be removed.") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message === "Account not found.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "The change conflicted with another admin operation. Try again." },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.name === "InsufficientPointsError") {
      return NextResponse.json({ error: "The balance cannot be negative." }, { status: 409 });
    }
    console.error("Admin action failed:", error);
    return NextResponse.json({ error: "The admin action failed." }, { status: 500 });
  }
}
