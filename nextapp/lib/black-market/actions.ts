"use server";

import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { DUPLICATE_EGG_REWARD } from "./constants";
import { pickByChance } from "./random";

type CommonErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INTERNAL_ERROR";
class ExpectedActionError extends Error {
  constructor(readonly code: "NO_ITEMS_IN_CRATE" | "NO_CRATES" | "NO_KEYS") {
    super(code);
  }
}

export type OpenCrateResult =
  | {
      type: "item";
      videoVariant: "gold" | "normal";
      itemId: string;
      itemName: string;
      imageUrl: string;
      group: string;
      itemType: "normal" | "progressive";
      maxLevel: number;
      useInputLabel: string | null;
      expiresAt: string | null;
      levels: {
        level: number;
        cost: number | null;
        imageUrl: string;
        description: string;
      }[];
    }
  | {
      type: "duplicate";
      videoVariant: "gold" | "normal";
      goldenEggsGained: number;
      totalGoldenEggs: number;
    }
  | {
      type: "eggs";
      videoVariant: "normal";
      goldenEggsGained: number;
      totalGoldenEggs: number;
    }
  | { type: "empty"; videoVariant: "normal" }
  | {
      type: "error";
      code:
        | "NO_CRATES"
        | "NO_KEYS"
        | "CRATE_NOT_FOUND"
        | "CRATE_INACTIVE"
        | "NO_ITEMS_IN_CRATE"
        | CommonErrorCode;
    };

export type UpgradeItemResult =
  | { type: "success"; newLevel: number; goldenEggsLeft: number }
  | {
      type: "error";
      code:
        | "NOT_OWNED"
        | "MAX_LEVEL"
        | "NOT_ENOUGH_EGGS"
        | "LEVEL_DATA_MISSING"
        | CommonErrorCode;
    };

export type EquipItemResult =
  | { type: "success"; group: string }
  | { type: "error"; code: "NOT_OWNED" | "INVALID_INPUT" | CommonErrorCode };

async function authorizeAccount(accountId: string) {
  const account = await getCurrentAccount();
  if (!account) return "UNAUTHENTICATED" as const;
  return account.id === accountId ? null : ("FORBIDDEN" as const);
}

async function lockAccount(
  transaction: Prisma.TransactionClient,
  accountId: string,
) {
  await transaction.$queryRaw`
    SELECT "id" FROM "WebAccount" WHERE "id" = ${accountId} FOR UPDATE
  `;
}

export async function openCrate(
  accountId: string,
  crateId: string,
): Promise<OpenCrateResult> {
  try {
    const authError = await authorizeAccount(accountId);
    if (authError) return { type: "error", code: authError };

    return await prisma.$transaction(async (transaction) => {
      await lockAccount(transaction, accountId);

      const crate = await transaction.blackMarketCrate.findUnique({
        where: { id: crateId },
        select: { active: true, starts_at: true, ends_at: true, requires_key: true },
      });
      if (!crate) return { type: "error", code: "CRATE_NOT_FOUND" };

      const now = new Date();
      if (
        !crate.active ||
        (crate.starts_at !== null && crate.starts_at > now) ||
        crate.ends_at <= now
      ) {
        return { type: "error", code: "CRATE_INACTIVE" };
      }

      const crateInventory = await transaction.blackMarketCrateInventory.findUnique({
        where: { account_id_crate_id: { account_id: accountId, crate_id: crateId } },
        select: { quantity: true },
      });
      if (!crateInventory || crateInventory.quantity < 1) {
        return { type: "error", code: "NO_CRATES" };
      }
      const keyInventory = crate.requires_key
        ? await transaction.blackMarketKeyInventory.findUnique({
            where: { account_id_crate_id: { account_id: accountId, crate_id: crateId } },
            select: { quantity: true },
          })
        : null;
      if (crate.requires_key && (!keyInventory || keyInventory.quantity < 1)) {
        return { type: "error", code: "NO_KEYS" };
      }

      const decrement = await transaction.blackMarketCrateInventory.updateMany({
        where: { account_id: accountId, crate_id: crateId, quantity: { gt: 0 } },
        data: { quantity: { decrement: 1 } },
      });
      if (decrement.count !== 1) throw new ExpectedActionError("NO_CRATES");
      if (crate.requires_key) {
        const keyDecrement = await transaction.blackMarketKeyInventory.updateMany({
          where: { account_id: accountId, crate_id: crateId, quantity: { gt: 0 } },
          data: { quantity: { decrement: 1 } },
        });
        if (keyDecrement.count !== 1) throw new ExpectedActionError("NO_KEYS");
      }

      const crateItems = await transaction.blackMarketCrateItem.findMany({
        where: { crate_id: crateId },
        include: {
          item: {
            include: { levels: { orderBy: { level: "asc" } } },
          },
        },
      });
      if (crateItems.length === 0) {
        throw new ExpectedActionError("NO_ITEMS_IN_CRATE");
      }

      const selected = pickByChance(
        crateItems.map((crateItem) => ({
          value: crateItem,
          chance: Number(crateItem.drop_chance),
        })),
      );
      await transaction.blackMarketCrate.update({
        where: { id: crateId },
        data: { open_count: { increment: 1 } },
      });
      if (!selected) return { type: "empty", videoVariant: "normal" };

      const item = selected.item;
      if (item.item_type === "golden_eggs") {
        const amount = selected.golden_eggs;
        if (!amount || amount <= 0) {
          throw new Error(`Golden Eggs reward in crate ${crateId} has no valid amount.`);
        }
        const account = await transaction.webAccount.update({
          where: { id: accountId },
          data: { golden_eggs: { increment: amount } },
          select: { golden_eggs: true },
        });
        return {
          type: "eggs",
          videoVariant: "normal",
          goldenEggsGained: amount,
          totalGoldenEggs: account.golden_eggs,
        };
      }

      const baseLevel = item.levels.find((level) => level.level === 1);
      const imageUrl = item.item_type === "progressive"
        ? baseLevel?.image_url
        : item.image_url;
      if (!imageUrl) throw new Error(`Black Market item ${item.id} has no image.`);
      if (item.item_type === "progressive" && !baseLevel) {
        throw new Error(`Progressive Black Market item ${item.id} has no level 1 data.`);
      }

      const owned = await transaction.blackMarketInventory.findUnique({
        where: {
          account_id_item_id: { account_id: accountId, item_id: item.id },
        },
        select: { id: true, expires_at: true },
      });
      if (owned && (!owned.expires_at || owned.expires_at > now)) {
        const updatedAccount = await transaction.webAccount.update({
          where: { id: accountId },
          data: { golden_eggs: { increment: DUPLICATE_EGG_REWARD } },
          select: { golden_eggs: true },
        });
        return {
          type: "duplicate",
          videoVariant:
            item.item_type === "progressive" || item.expiry === "permanent"
              ? "gold"
              : "normal",
          goldenEggsGained: DUPLICATE_EGG_REWARD,
          totalGoldenEggs: updatedAccount.golden_eggs,
        };
      }

      const expiresAt = item.expiry === "seven_days"
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        : item.expiry === "thirty_days"
          ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          : item.expiry === "event_end"
            ? crate.ends_at
            : null;
      if (item.expiry === "event_end" && !expiresAt) {
        throw new Error(`Black Market crate ${crateId} has no event end date.`);
      }
      const inventoryData = {
          account_id: accountId,
          item_id: item.id,
          group: item.group,
          current_level: 1,
          is_equipped: false,
          use_input: null,
          expires_at: expiresAt,
        };
      if (owned) {
        await transaction.blackMarketInventory.update({
          where: { account_id_item_id: { account_id: accountId, item_id: item.id } },
          data: inventoryData,
        });
      } else {
        await transaction.blackMarketInventory.create({ data: inventoryData });
      }
      return {
        type: "item",
        videoVariant:
          item.item_type === "progressive" || item.expiry === "permanent"
            ? "gold"
            : "normal",
        itemId: item.id,
        itemName: item.name,
        imageUrl,
        group: item.group,
        itemType: item.item_type,
        maxLevel: item.max_level,
        useInputLabel: item.use_input_label,
        expiresAt: expiresAt?.toISOString() ?? null,
        levels: item.levels.map((level) => ({
          level: level.level,
          cost: level.upgrade_cost,
          imageUrl: level.image_url,
          description: level.description,
        })),
      };
    });
  } catch (error) {
    if (error instanceof ExpectedActionError) {
      return { type: "error", code: error.code };
    }
    console.error("Black Market crate opening failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function upgradeItem(
  accountId: string,
  itemId: string,
): Promise<UpgradeItemResult> {
  try {
    const authError = await authorizeAccount(accountId);
    if (authError) return { type: "error", code: authError };

    return await prisma.$transaction(async (transaction) => {
      await lockAccount(transaction, accountId);
      const owned = await transaction.blackMarketInventory.findUnique({
        where: { account_id_item_id: { account_id: accountId, item_id: itemId } },
        include: { item: true },
      });
      if (!owned || (owned.expires_at && owned.expires_at <= new Date())) {
        return { type: "error", code: "NOT_OWNED" };
      }
      if (owned.item.item_type !== "progressive") {
        return { type: "error", code: "MAX_LEVEL" };
      }

      const nextLevel = owned.current_level + 1;
      if (nextLevel > owned.item.max_level) {
        return { type: "error", code: "MAX_LEVEL" };
      }

      const levelData = await transaction.blackMarketItemLevel.findUnique({
        where: { item_id_level: { item_id: itemId, level: nextLevel } },
        select: { upgrade_cost: true },
      });
      if (!levelData || levelData.upgrade_cost === null || levelData.upgrade_cost <= 0) {
        return { type: "error", code: "LEVEL_DATA_MISSING" };
      }

      const debit = await transaction.webAccount.updateMany({
        where: { id: accountId, golden_eggs: { gte: levelData.upgrade_cost } },
        data: { golden_eggs: { decrement: levelData.upgrade_cost } },
      });
      if (debit.count !== 1) return { type: "error", code: "NOT_ENOUGH_EGGS" };

      await transaction.blackMarketInventory.update({
        where: { account_id_item_id: { account_id: accountId, item_id: itemId } },
        data: { current_level: nextLevel },
      });
      const account = await transaction.webAccount.findUniqueOrThrow({
        where: { id: accountId },
        select: { golden_eggs: true },
      });
      return {
        type: "success",
        newLevel: nextLevel,
        goldenEggsLeft: account.golden_eggs,
      };
    });
  } catch (error) {
    console.error("Black Market item upgrade failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function equipItem(
  accountId: string,
  itemId: string,
  userInput: string | null = null,
): Promise<EquipItemResult> {
  if (
    userInput !== null &&
    (typeof userInput !== "string" ||
      userInput.trim().length === 0 ||
      userInput.length > 500)
  ) {
    return { type: "error", code: "INVALID_INPUT" };
  }
  try {
    const authError = await authorizeAccount(accountId);
    if (authError) return { type: "error", code: authError };

    return await prisma.$transaction(async (transaction) => {
      await lockAccount(transaction, accountId);
      await transaction.blackMarketInventory.updateMany({
        where: { account_id: accountId, is_equipped: true, expires_at: { lte: new Date() } },
        data: { is_equipped: false },
      });
      const owned = await transaction.blackMarketInventory.findUnique({
        where: { account_id_item_id: { account_id: accountId, item_id: itemId } },
        select: {
          group: true,
          expires_at: true,
          item: { select: { use_input_label: true } },
        },
      });
      if (!owned || (owned.expires_at && owned.expires_at <= new Date())) {
        return { type: "error", code: "NOT_OWNED" };
      }
      if (
        owned.item.use_input_label
          ? userInput === null || userInput.trim().length === 0
          : userInput !== null
      ) {
        return { type: "error", code: "INVALID_INPUT" };
      }

      await transaction.blackMarketInventory.updateMany({
        where: { account_id: accountId, group: owned.group, is_equipped: true },
        data: { is_equipped: false },
      });
      await transaction.blackMarketInventory.update({
        where: { account_id_item_id: { account_id: accountId, item_id: itemId } },
        data: { is_equipped: true, use_input: userInput?.trim() ?? null },
      });
      return { type: "success", group: owned.group };
    });
  } catch (error) {
    console.error("Black Market item equip failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}
