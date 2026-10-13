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
      throw new ShopRevertError("Shop operaci nelze vrátit.");
    }
    const existingRevert = await transaction.adminAuditLog.findUnique({
      where: { reverted_log_id: original.id },
      select: { id: true },
    });
    if (existingRevert) throw new ShopRevertError("Tato shop operace už byla vrácena.");

    const details = original.details;
    if (!isRecord(details)) throw new ShopRevertError("Záznam shop operace nemá platná data.");

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
        throw new ShopRevertError("Záznam nákupu nemá potřebná data pro vrácení.");
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
        throw new ShopRevertError("Pro vrácení nákupu chybí propojený účet.");
      }
      const productId = details.productId;
      const redemptionId =
        typeof details.redemptionId === "string" ? details.redemptionId : null;
      const addToInventory = details.addToInventory !== false;
      await changePointBalance(
        transaction,
        details.currency,
        providerUserId,
        details.price,
        "Vrácení shop nákupu",
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
          throw new ShopRevertError("Zakoupenou položku už nelze odebrat z inventáře.");
        }
      } else if (redemptionId) {
        await transaction.shopRedemption.delete({
          where: { id: redemptionId },
        });
      } else {
        throw new ShopRevertError("Záznam okamžitého nákupu nemá ID použití.");
      }
    } else if (original.action === "shop.redeemed") {
      if (
        typeof details.productId !== "string" ||
        typeof details.redemptionId !== "string" ||
        !original.target_account_id
      ) {
        throw new ShopRevertError("Záznam použití nemá potřebná data pro vrácení.");
      }
      const redemption = await transaction.shopRedemption.findUnique({
        where: { id: details.redemptionId },
        select: { id: true, product_id: true },
      });
      if (!redemption || redemption.product_id !== details.productId) {
        throw new ShopRevertError("Použitou položku už nelze obnovit.");
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
        throw new ShopRevertError("Záznam položky nemá identifikátor.");
      }
      const product = await transaction.shopProduct.findUnique({
        where: { id: details.productId },
        select: { id: true },
      });
      if (!product) throw new ShopRevertError("Shop položka nebyla nalezena.");
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
          typeof previous.addToInventory !== "boolean"
        ) {
          throw new ShopRevertError("Původní nastavení položky chybí.");
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
          },
        });
      }
    } else {
      throw new ShopRevertError("Tento typ shop operace zatím nelze vrátit.");
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
  if (!admin) return NextResponse.json({ error: "Přihlas se." }, { status: 401 });
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Přístup odepřen." }, { status: 403 });
  }

  const [accounts, rates, logs, pointEvents, streamEvents] = await Promise.all([
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
  ]);

  return NextResponse.json({
    accounts,
    rates,
    logs,
    pointEvents,
    streamEvents,
    selfAccountId: admin.id,
  });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ error: "Neplatný požadavek." }, { status: 403 });
  }
  const admin = await getCurrentAccount();
  if (!admin) {
    return NextResponse.json({ error: "Přihlas se." }, { status: 401 });
  }
  if (admin.role !== "admin") {
    return NextResponse.json({ error: "Přístup odepřen." }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data požadavku." }, { status: 400 });
  }
  if (typeof body !== "object" || body === null || !("action" in body)) {
    return NextResponse.json({ error: "Chybí akce." }, { status: 400 });
  }

  try {
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
          { error: "Zkontroluj datum a čas začátku a konce streamu." },
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
        return NextResponse.json({ error: "Termín streamu nebyl nalezen." }, { status: 404 });
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
          { error: "Vlastní roli zde změnit nelze." },
          { status: 400 },
        );
      }
      await prisma.$transaction(
        async (transaction) => {
          const target = await transaction.webAccount.findUnique({
            where: { id: targetAccountId },
            select: { id: true, role: true },
          });
          if (!target) throw new Error("Účet nebyl nalezen.");
          if (target.role === "admin" && requestedRole === "user") {
            const adminCount = await transaction.webAccount.count({
              where: { role: "admin" },
            });
            if (adminCount <= 1) throw new Error("Posledního administrátora nelze odebrat.");
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
          { error: "Účet nemá propojenou odpovídající identitu." },
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

    return NextResponse.json({ error: "Neplatná akce nebo údaje." }, { status: 400 });
  } catch (error) {
    if (error instanceof ShopRevertError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "Shop operaci nelze vrátit." ? 404 : 409 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "Shop operaci nelze vrátit." || error.message === "Shop položka nebyla nalezena.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
      if (
        error.message === "Tato shop operace už byla vrácena." ||
        error.message.includes("nelze") ||
        error.message.includes("chybí") ||
        error.message.includes("nebyla nalezena")
      ) {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Tato shop operace už byla vrácena." },
        { status: 409 },
      );
    }
    if (error instanceof Error) {
      if (error.message === "Posledního administrátora nelze odebrat.") {
        return NextResponse.json({ error: error.message }, { status: 409 });
      }
      if (error.message === "Účet nebyl nalezen.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Změna kolidovala s jinou administrátorskou operací. Zkus ji znovu." },
        { status: 409 },
      );
    }
    if (error instanceof Error && error.name === "InsufficientPointsError") {
      return NextResponse.json({ error: "Zůstatek nemůže být záporný." }, { status: 409 });
    }
    console.error("Admin action failed:", error);
    return NextResponse.json({ error: "Administrátorská akce selhala." }, { status: 500 });
  }
}
