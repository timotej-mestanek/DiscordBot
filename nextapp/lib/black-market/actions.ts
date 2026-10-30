"use server";

import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { DUPLICATE_EGG_REWARD } from "./constants";
import { pickWeighted } from "./random";

type CommonErrorCode = "UNAUTHENTICATED" | "FORBIDDEN" | "INTERNAL_ERROR";
class ExpectedActionError extends Error {
  constructor(readonly code: "NO_ITEMS_IN_CRATE") {
    super(code);
  }
}

export type OpenCrateResult =
  | {
      type: "item";
      itemId: string;
      itemName: string;
      imageUrl: string;
      group: string;
      maxLevel: number;
      levels: { level: number; cost: number | null; imageUrl: string }[];
    }
  | {
      type: "duplicate";
      goldenEggsGained: number;
      totalGoldenEggs: number;
    }
  | {
      type: "error";
      code:
        | "NO_CRATES"
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
  | { type: "error"; code: "NOT_OWNED" | CommonErrorCode };

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
        select: { active: true, starts_at: true, ends_at: true },
      });
      if (!crate) return { type: "error", code: "CRATE_NOT_FOUND" };

      const now = new Date();
      if (
        !crate.active ||
        (crate.starts_at !== null && crate.starts_at > now) ||
        (crate.ends_at !== null && crate.ends_at < now)
      ) {
        return { type: "error", code: "CRATE_INACTIVE" };
      }

      const decrement = await transaction.blackMarketCrateInventory.updateMany({
        where: { account_id: accountId, crate_id: crateId, quantity: { gt: 0 } },
        data: { quantity: { decrement: 1 } },
      });
      if (decrement.count !== 1) return { type: "error", code: "NO_CRATES" };

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

      const selected = pickWeighted(
        crateItems.map((crateItem) => ({
          value: crateItem.item,
          weight: crateItem.weight,
        })),
      );
      const baseLevel = selected.levels.find((level) => level.level === 1);
      if (!baseLevel) throw new Error(`Black Market item ${selected.id} has no level 1 data.`);

      await transaction.blackMarketCrate.update({
        where: { id: crateId },
        data: { open_count: { increment: 1 } },
      });

      const owned = await transaction.blackMarketInventory.findUnique({
        where: {
          account_id_item_id: { account_id: accountId, item_id: selected.id },
        },
        select: { id: true },
      });
      if (owned) {
        const updatedAccount = await transaction.webAccount.update({
          where: { id: accountId },
          data: { golden_eggs: { increment: DUPLICATE_EGG_REWARD } },
          select: { golden_eggs: true },
        });
        return {
          type: "duplicate",
          goldenEggsGained: DUPLICATE_EGG_REWARD,
          totalGoldenEggs: updatedAccount.golden_eggs,
        };
      }

      await transaction.blackMarketInventory.create({
        data: {
          account_id: accountId,
          item_id: selected.id,
          group: selected.group,
          current_level: 1,
          is_equipped: false,
        },
      });
      return {
        type: "item",
        itemId: selected.id,
        itemName: selected.name,
        imageUrl: baseLevel.image_url,
        group: selected.group,
        maxLevel: selected.max_level,
        levels: selected.levels.map((level) => ({
          level: level.level,
          cost: level.upgrade_cost,
          imageUrl: level.image_url,
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
      if (!owned) return { type: "error", code: "NOT_OWNED" };

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
): Promise<EquipItemResult> {
  try {
    const authError = await authorizeAccount(accountId);
    if (authError) return { type: "error", code: authError };

    return await prisma.$transaction(async (transaction) => {
      await lockAccount(transaction, accountId);
      const owned = await transaction.blackMarketInventory.findUnique({
        where: { account_id_item_id: { account_id: accountId, item_id: itemId } },
        select: { group: true },
      });
      if (!owned) return { type: "error", code: "NOT_OWNED" };

      await transaction.blackMarketInventory.updateMany({
        where: { account_id: accountId, group: owned.group, is_equipped: true },
        data: { is_equipped: false },
      });
      await transaction.blackMarketInventory.update({
        where: { account_id_item_id: { account_id: accountId, item_id: itemId } },
        data: { is_equipped: true },
      });
      return { type: "success", group: owned.group };
    });
  } catch (error) {
    console.error("Black Market item equip failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}
