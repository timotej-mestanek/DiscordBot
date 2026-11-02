"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { isBlackMarketItemImageUrl } from "@/lib/r2";

export type AdminActionResult<T = undefined> =
  | { type: "success"; data?: T }
  | {
      type: "error";
      code:
        | "FORBIDDEN"
        | "VALIDATION_ERROR"
        | "NOT_FOUND"
        | "CONFLICT"
        | "LINKED_PRODUCTS"
        | "KEY_PRODUCTS_EXIST"
        | "ITEM_ID_CONFLICT"
        | "EGG_REWARD_EXISTS"
        | "CRATE_REWARD_EXISTS"
        | "INTERNAL_ERROR";
    }
  | {
      type: "error";
      code: "CONFIRMATION_REQUIRED";
      data: T;
    };

type CrateInput = {
  id: string;
  name: string;
  active: boolean;
  requiresKey: boolean;
  startsAt: string | null;
  endsAt: string;
  previewImageUrl: string | null;
  textureUrl: string | null;
};

type ItemInput = {
  id: string;
  name: string;
  group: string;
  itemType: "normal" | "progressive" | "golden_eggs";
  expiry: "permanent" | "seven_days" | "thirty_days" | "event_end";
  imageUrl: string;
  maxLevel: number;
  crateAssignments: CrateAssignmentInput[];
};

type CrateAssignmentInput = {
  crateId: string;
  dropChance: number;
  goldenEggs: number | null;
};

type ItemLevelInput = {
  itemId: string;
  level: number;
  upgradeCost: number | null;
  imageUrl: string;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const adminPath = "/admin/black-market";
const DROP_CHANCE_SCALE = 100;

async function isAdmin() {
  return (await getCurrentAccount())?.role === "admin";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function uniqueConstraintTarget(error: unknown): string[] {
  if (!isRecord(error) || !isRecord(error.meta)) return [];
  const target = error.meta.target;
  if (typeof target === "string") return [target];
  return Array.isArray(target)
    ? target.filter((value): value is string => typeof value === "string")
    : [];
}

function isValidSlug(value: unknown): value is string {
  return typeof value === "string" && value.length <= 64 && slugPattern.test(value);
}

function isValidDate(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string" &&
    value.length <= 40 &&
    !Number.isNaN(Date.parse(value))
  );
}

function isOptionalUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== "string") return false;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function revalidateCrates() {
  revalidatePath(adminPath);
  revalidatePath(`${adminPath}/crates`);
  revalidatePath("/black-market");
}

function revalidateItems() {
  revalidatePath(adminPath);
  revalidatePath(`${adminPath}/items`);
  revalidatePath("/black-market");
}

function validCrateInput(input: unknown): input is CrateInput {
  if (!isRecord(input)) return false;
  return (
    isValidSlug(input.id) &&
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    input.name.trim().length <= 100 &&
    typeof input.active === "boolean" &&
    typeof input.requiresKey === "boolean" &&
    typeof input.endsAt === "string" &&
    isValidDate(input.startsAt) &&
    isValidDate(input.endsAt) &&
    isOptionalUrl(input.previewImageUrl) &&
    isOptionalUrl(input.textureUrl) &&
    (!input.startsAt ||
      !input.endsAt ||
      new Date(input.startsAt).getTime() <= new Date(input.endsAt).getTime())
  );
}

function validItemInput(input: unknown): input is ItemInput {
  if (!isRecord(input) || !Array.isArray(input.crateAssignments)) return false;
  const assignments = input.crateAssignments;
  if (
    !assignments.every(
      (assignment): assignment is CrateAssignmentInput =>
        isRecord(assignment) &&
        isValidSlug(assignment.crateId) &&
        typeof assignment.dropChance === "number" &&
        Number.isFinite(assignment.dropChance) &&
        assignment.dropChance >= 0 &&
        assignment.dropChance <= 100 &&
        Math.abs(assignment.dropChance * DROP_CHANCE_SCALE -
          Math.round(assignment.dropChance * DROP_CHANCE_SCALE)) < 1e-8 &&
        (assignment.goldenEggs === null ||
          (typeof assignment.goldenEggs === "number" &&
            Number.isSafeInteger(assignment.goldenEggs) &&
            assignment.goldenEggs > 0 &&
            assignment.goldenEggs <= 1_000_000_000)),
    ) ||
    new Set(assignments.map((entry) => isRecord(entry) ? entry.crateId : null)).size !==
      assignments.length
  ) {
    return false;
  }
  const chanceTotals = assignments.reduce(
    (totals, assignment) =>
      totals.set(
        assignment.crateId,
        (totals.get(assignment.crateId) ?? 0) +
          Math.round(assignment.dropChance * DROP_CHANCE_SCALE),
      ),
    new Map<string, number>(),
  );
  return (
    isValidSlug(input.id) &&
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    input.name.trim().length <= 100 &&
    typeof input.group === "string" &&
    /^[a-z0-9_-]{1,32}$/u.test(input.group) &&
    (input.itemType === "normal" ||
      input.itemType === "progressive" ||
      input.itemType === "golden_eggs") &&
    (input.itemType === "normal"
      ? input.expiry === "permanent" ||
        input.expiry === "seven_days" ||
        input.expiry === "thirty_days" ||
        input.expiry === "event_end"
      : input.expiry === "permanent") &&
    isBlackMarketItemImageUrl(input.imageUrl) &&
    typeof input.maxLevel === "number" &&
    Number.isSafeInteger(input.maxLevel) &&
    input.maxLevel >= 1 &&
    input.maxLevel <= 100 &&
    (input.itemType === "progressive"
      ? input.maxLevel >= 1
      : input.maxLevel === 1) &&
    assignments.every((assignment) =>
      input.itemType === "golden_eggs"
        ? assignment.goldenEggs !== null
        : assignment.goldenEggs === null,
    ) &&
    [...chanceTotals.values()].every((total) => total <= 100 * DROP_CHANCE_SCALE)
  );
}

async function lockAndValidateCrateChances(
  transaction: Prisma.TransactionClient,
  assignments: CrateAssignmentInput[],
) {
  const totals = new Map<string, number>();
  for (const assignment of assignments) {
    totals.set(
      assignment.crateId,
      (totals.get(assignment.crateId) ?? 0) +
        Math.round(assignment.dropChance * DROP_CHANCE_SCALE),
    );
  }
  for (const [crateId, addedChance] of [...totals].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const crates = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "BlackMarketCrate" WHERE "id" = ${crateId} FOR UPDATE
    `;
    if (crates.length !== 1) throw new Error("CRATE_NOT_FOUND");
    const current = await transaction.blackMarketCrateItem.aggregate({
      where: { crate_id: crateId },
      _sum: { drop_chance: true },
    });
    const currentChance = Math.round(
      Number(current._sum.drop_chance ?? 0) * DROP_CHANCE_SCALE,
    );
    if (currentChance + addedChance > 100 * DROP_CHANCE_SCALE) {
      throw new Error("DROP_CHANCE_EXCEEDED");
    }
  }
}

function isValidDropChance(value: number) {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 100 &&
    Math.abs(value * DROP_CHANCE_SCALE -
      Math.round(value * DROP_CHANCE_SCALE)) < 1e-8
  );
}

async function lockAndValidateCrateChanceUpdate(
  transaction: Prisma.TransactionClient,
  crateId: string,
  crateItemId: string,
  dropChance: number,
) {
  const crates = await transaction.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "BlackMarketCrate" WHERE "id" = ${crateId} FOR UPDATE
    `;
  if (crates.length !== 1) throw new Error("CRATE_NOT_FOUND");
  const current = await transaction.blackMarketCrateItem.aggregate({
    where: { crate_id: crateId, id: { not: crateItemId } },
    _sum: { drop_chance: true },
  });
  const currentChance = Math.round(
    Number(current._sum.drop_chance ?? 0) * DROP_CHANCE_SCALE,
  );
  if (
    currentChance + Math.round(dropChance * DROP_CHANCE_SCALE) >
    100 * DROP_CHANCE_SCALE
  ) {
    throw new Error("DROP_CHANCE_EXCEEDED");
  }
}

export async function createCrate(
  input: CrateInput,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!validCrateInput(input)) return { type: "error", code: "VALIDATION_ERROR" };
  try {
    await prisma.blackMarketCrate.create({
      data: {
        id: input.id,
        name: input.name.trim(),
        active: input.active,
        requires_key: input.requiresKey,
        starts_at: input.startsAt ? new Date(input.startsAt) : null,
        ends_at: new Date(input.endsAt),
        preview_image_url: input.previewImageUrl,
        texture_url: input.textureUrl,
      },
    });
    revalidateCrates();
    return { type: "success" };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { type: "error", code: "CONFLICT" };
    }
    console.error("Black Market crate creation failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function updateCrate(
  crateId: string,
  input: CrateInput,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!validCrateInput(input) || !isValidSlug(crateId) || crateId !== input.id) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    if (!input.requiresKey) {
      const keyProducts = await prisma.shopProduct.count({
        where: {
          product_type: "black_market_key",
          black_market_crate_id: crateId,
        },
      });
      if (keyProducts > 0) return { type: "error", code: "KEY_PRODUCTS_EXIST" };
    }
    const saved = await prisma.blackMarketCrate.updateMany({
      where: { id: crateId },
      data: {
        name: input.name.trim(),
        active: input.active,
        requires_key: input.requiresKey,
        starts_at: input.startsAt ? new Date(input.startsAt) : null,
        ends_at: new Date(input.endsAt),
        preview_image_url: input.previewImageUrl,
        texture_url: input.textureUrl,
      },
    });
    if (saved.count !== 1) return { type: "error", code: "NOT_FOUND" };
    revalidateCrates();
    return { type: "success" };
  } catch (error) {
    console.error("Black Market crate update failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function deleteCrate(crateId: string): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!isValidSlug(crateId)) return { type: "error", code: "VALIDATION_ERROR" };
  try {
    const linkedProducts = await prisma.shopProduct.count({
      where: { black_market_crate_id: crateId },
    });
    if (linkedProducts > 0) return { type: "error", code: "LINKED_PRODUCTS" };
    const deleted = await prisma.blackMarketCrate.deleteMany({ where: { id: crateId } });
    if (deleted.count !== 1) return { type: "error", code: "NOT_FOUND" };
    revalidateCrates();
    return { type: "success" };
  } catch (error) {
    console.error("Black Market crate deletion failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function createItem(input: ItemInput): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!validItemInput(input)) return { type: "error", code: "VALIDATION_ERROR" };
  try {
    await prisma.$transaction(async (transaction) => {
      if (input.itemType === "golden_eggs") {
        const existingEggReward = await transaction.blackMarketItem.findFirst({
          where: { item_type: "golden_eggs" },
          select: { id: true },
        });
        if (existingEggReward) throw new Error("EGG_REWARD_EXISTS");
      }
      await lockAndValidateCrateChances(transaction, input.crateAssignments);
      await transaction.blackMarketItem.create({
        data: {
          id: input.id,
          name: input.name.trim(),
          group: input.group,
          item_type: input.itemType,
          expiry: input.expiry,
          image_url: input.imageUrl,
          max_level: input.maxLevel,
          ...(input.itemType === "progressive"
            ? {
                levels: {
                  create: {
                    level: 1,
                    upgrade_cost: null,
                    image_url: input.imageUrl,
                  },
                },
              }
            : {}),
          crates: {
            create: input.crateAssignments.map((assignment) => ({
              crate_id: assignment.crateId,
              drop_chance: assignment.dropChance,
              golden_eggs: assignment.goldenEggs,
            })),
          },
        },
      });
    });
    revalidateItems();
    for (const assignment of input.crateAssignments) {
      revalidatePath(`${adminPath}/crates/${assignment.crateId}`);
    }
    return { type: "success" };
  } catch (error) {
    if (error instanceof Error && error.message === "CRATE_NOT_FOUND") {
      return { type: "error", code: "VALIDATION_ERROR" };
    }
    if (error instanceof Error && error.message === "DROP_CHANCE_EXCEEDED") {
      return { type: "error", code: "VALIDATION_ERROR" };
    }
    if (error instanceof Error && error.message === "EGG_REWARD_EXISTS") {
      return { type: "error", code: "EGG_REWARD_EXISTS" };
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const target = uniqueConstraintTarget(error);
      if (target.some((value) => value.includes("item_type"))) {
        return { type: "error", code: "EGG_REWARD_EXISTS" };
      }
      if (target.some((value) => value.includes("golden_eggs"))) {
        return { type: "error", code: "CRATE_REWARD_EXISTS" };
      }
      if (target.some((value) => value === "id" || value.includes("BlackMarketItem_pkey"))) {
        return { type: "error", code: "ITEM_ID_CONFLICT" };
      }
      return { type: "error", code: "CONFLICT" };
    }
    console.error("Black Market item creation failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function updateItem(
  itemId: string,
  input: ItemInput,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!validItemInput(input) || !isValidSlug(itemId) || input.id !== itemId) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    const existing = await prisma.blackMarketItem.findUnique({
      where: { id: itemId },
      select: { item_type: true },
    });
    if (!existing) return { type: "error", code: "NOT_FOUND" };
    if (existing.item_type !== input.itemType) {
      return { type: "error", code: "VALIDATION_ERROR" };
    }
    const levelsAboveLimit = await prisma.blackMarketItemLevel.count({
      where: { item_id: itemId, level: { gt: input.maxLevel } },
    });
    if (levelsAboveLimit > 0) return { type: "error", code: "VALIDATION_ERROR" };
    const saved = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.blackMarketItem.updateMany({
        where: { id: itemId },
        data: {
          name: input.name.trim(),
          group: input.group,
          image_url: input.imageUrl,
          max_level: input.maxLevel,
          expiry: input.expiry,
        },
      });
      if (existing.item_type === "progressive") {
        await transaction.blackMarketItemLevel.upsert({
          where: { item_id_level: { item_id: itemId, level: 1 } },
          create: {
            item_id: itemId,
            level: 1,
            upgrade_cost: null,
            image_url: input.imageUrl,
          },
          update: { image_url: input.imageUrl },
        });
      }
      return updated;
    });
    if (saved.count !== 1) return { type: "error", code: "NOT_FOUND" };
    revalidateItems();
    return { type: "success" };
  } catch (error) {
    console.error("Black Market item update failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function deleteItem(
  itemId: string,
  confirmOwnedDeletion: boolean,
): Promise<AdminActionResult<{ ownedCount: number }>> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!isValidSlug(itemId) || typeof confirmOwnedDeletion !== "boolean") {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    const result = await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT "id" FROM "BlackMarketItem" WHERE "id" = ${itemId} FOR UPDATE`;
      const item = await transaction.blackMarketItem.findUnique({
        where: { id: itemId },
        select: { _count: { select: { owned_by: true } } },
      });
      if (!item) return { type: "error" as const, code: "NOT_FOUND" as const };
      if (item._count.owned_by > 0 && !confirmOwnedDeletion) {
        return {
          type: "confirmation-required" as const,
          ownedCount: item._count.owned_by,
        };
      }
      await transaction.blackMarketItem.delete({ where: { id: itemId } });
      return { type: "success" as const, ownedCount: item._count.owned_by };
    });
    if (result.type === "error") return result;
    if (result.type === "confirmation-required") {
      return {
        type: "error",
        code: "CONFIRMATION_REQUIRED",
        data: { ownedCount: result.ownedCount },
      };
    }
    revalidateItems();
    revalidateCrates();
    return { type: "success", data: { ownedCount: result.ownedCount } };
  } catch (error) {
    console.error("Black Market item deletion failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function upsertItemLevel(
  input: ItemLevelInput,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!isRecord(input)) return { type: "error", code: "VALIDATION_ERROR" };
  if (
    !isValidSlug(input.itemId) ||
    !Number.isSafeInteger(input.level) ||
    typeof input.level !== "number" ||
    input.level < 1 ||
    input.level > 100 ||
    (input.level === 1
      ? input.upgradeCost !== null
      : typeof input.upgradeCost !== "number" ||
        !Number.isSafeInteger(input.upgradeCost) ||
        input.upgradeCost <= 0 ||
        input.upgradeCost > 1_000_000_000) ||
    !isBlackMarketItemImageUrl(input.imageUrl)
  ) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    const item = await prisma.blackMarketItem.findUnique({
      where: { id: input.itemId },
      select: { max_level: true, item_type: true },
    });
    if (!item) return { type: "error", code: "NOT_FOUND" };
    if (
      item.item_type !== "progressive" ||
      input.level > item.max_level
    ) {
      return { type: "error", code: "VALIDATION_ERROR" };
    }
    await prisma.$transaction(async (transaction) => {
      await transaction.blackMarketItemLevel.upsert({
        where: { item_id_level: { item_id: input.itemId, level: input.level } },
        create: {
          item_id: input.itemId,
          level: input.level,
          upgrade_cost: input.upgradeCost,
          image_url: input.imageUrl,
        },
        update: { upgrade_cost: input.upgradeCost, image_url: input.imageUrl },
      });
      if (input.level === 1) {
        await transaction.blackMarketItem.update({
          where: { id: input.itemId },
          data: { image_url: input.imageUrl },
        });
      }
    });
    revalidateItems();
    revalidatePath(`${adminPath}/items/${input.itemId}`);
    revalidatePath("/black-market");
    return { type: "success" };
  } catch (error) {
    console.error("Black Market item level save failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function deleteItemLevel(
  itemId: string,
  level: number,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!isValidSlug(itemId) || !Number.isSafeInteger(level) || level < 1 || level > 100) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    const deleted = await prisma.blackMarketItemLevel.deleteMany({
      where: { item_id: itemId, level },
    });
    if (deleted.count !== 1) return { type: "error", code: "NOT_FOUND" };
    revalidateItems();
    revalidatePath(`${adminPath}/items/${itemId}`);
    revalidatePath("/black-market");
    return { type: "success" };
  } catch (error) {
    console.error("Black Market item level deletion failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function addItemToCrate(
  crateId: string,
  itemId: string,
  dropChance: number,
  goldenEggs: number | null,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (
    !isValidSlug(crateId) ||
    !isValidSlug(itemId) ||
    !isValidDropChance(dropChance) ||
    (goldenEggs !== null &&
      (!Number.isSafeInteger(goldenEggs) ||
        goldenEggs < 1 ||
        goldenEggs > 1_000_000_000))
  ) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const item = await transaction.blackMarketItem.findUnique({
        where: { id: itemId },
        select: { item_type: true },
      });
      if (!item) throw new Error("ITEM_NOT_FOUND");
      if (
        (item.item_type === "golden_eggs") !== (goldenEggs !== null)
      ) {
        throw new Error("INVALID_EGG_REWARD");
      }
      await lockAndValidateCrateChances(transaction, [
        { crateId, dropChance, goldenEggs },
      ]);
      if (item.item_type !== "golden_eggs") {
        const existingEntry = await transaction.blackMarketCrateItem.findFirst({
          where: { crate_id: crateId, item_id: itemId },
          select: { id: true },
        });
        if (existingEntry) throw new Error("ITEM_ALREADY_IN_CRATE");
      }
      await transaction.blackMarketCrateItem.create({
        data: {
          crate_id: crateId,
          item_id: itemId,
          drop_chance: dropChance,
          golden_eggs: goldenEggs,
        },
      });
    });
    revalidatePath(`${adminPath}/crates/${crateId}`);
    revalidateCrates();
    return { type: "success" };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { type: "error", code: "CONFLICT" };
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2003") {
      return { type: "error", code: "NOT_FOUND" };
    }
    if (
      error instanceof Error &&
      ["CRATE_NOT_FOUND", "ITEM_NOT_FOUND"].includes(error.message)
    ) {
      return { type: "error", code: "NOT_FOUND" };
    }
    if (
      error instanceof Error &&
      ["DROP_CHANCE_EXCEEDED", "INVALID_EGG_REWARD"].includes(error.message)
    ) {
      return { type: "error", code: "VALIDATION_ERROR" };
    }
    if (error instanceof Error && error.message === "ITEM_ALREADY_IN_CRATE") {
      return { type: "error", code: "CONFLICT" };
    }
    console.error("Black Market crate item add failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function updateCrateItemChance(
  crateId: string,
  crateItemId: string,
  dropChance: number,
  goldenEggs: number | null,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (
    !isValidSlug(crateId) ||
    typeof crateItemId !== "string" ||
    crateItemId.length < 1 ||
    crateItemId.length > 100 ||
    !isValidDropChance(dropChance) ||
    (goldenEggs !== null &&
      (!Number.isSafeInteger(goldenEggs) ||
        goldenEggs < 1 ||
        goldenEggs > 1_000_000_000))
  ) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    await prisma.$transaction(async (transaction) => {
      const crateItem = await transaction.blackMarketCrateItem.findUnique({
        where: { id: crateItemId },
        select: {
          crate_id: true,
          item: { select: { item_type: true } },
        },
      });
      if (!crateItem || crateItem.crate_id !== crateId) {
        throw new Error("CRATE_ITEM_NOT_FOUND");
      }
      if (
        (crateItem.item.item_type === "golden_eggs") !== (goldenEggs !== null)
      ) {
        throw new Error("INVALID_EGG_REWARD");
      }
      await lockAndValidateCrateChanceUpdate(
        transaction,
        crateId,
        crateItemId,
        dropChance,
      );
      const updated = await transaction.blackMarketCrateItem.updateMany({
        where: { crate_id: crateId, id: crateItemId },
        data: { drop_chance: dropChance, golden_eggs: goldenEggs },
      });
      if (updated.count !== 1) throw new Error("CRATE_ITEM_NOT_FOUND");
    });
    revalidatePath(`${adminPath}/crates/${crateId}`);
    return { type: "success" };
  } catch (error) {
    if (
      error instanceof Error &&
      ["CRATE_NOT_FOUND", "ITEM_NOT_FOUND", "CRATE_ITEM_NOT_FOUND"].includes(error.message)
    ) {
      return { type: "error", code: "NOT_FOUND" };
    }
    if (
      error instanceof Error &&
      ["DROP_CHANCE_EXCEEDED", "INVALID_EGG_REWARD"].includes(error.message)
    ) {
      return { type: "error", code: "VALIDATION_ERROR" };
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return { type: "error", code: "CONFLICT" };
    }
    console.error("Black Market crate item chance update failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function removeItemFromCrate(
  crateId: string,
  crateItemId: string,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (
    !isValidSlug(crateId) ||
    typeof crateItemId !== "string" ||
    crateItemId.length < 1 ||
    crateItemId.length > 100
  ) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    const removed = await prisma.blackMarketCrateItem.deleteMany({
      where: { crate_id: crateId, id: crateItemId },
    });
    if (removed.count !== 1) return { type: "error", code: "NOT_FOUND" };
    revalidatePath(`${adminPath}/crates/${crateId}`);
    return { type: "success" };
  } catch (error) {
    console.error("Black Market crate item removal failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}
