"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export type AdminActionResult<T = undefined> =
  | { type: "success"; data?: T }
  | {
      type: "error";
      code:
        | "FORBIDDEN"
        | "VALIDATION_ERROR"
        | "NOT_FOUND"
        | "CONFLICT"
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
  startsAt: string | null;
  endsAt: string | null;
  previewImageUrl: string | null;
  textureUrl: string | null;
};

type ItemInput = {
  id: string;
  name: string;
  group: string;
  maxLevel: number;
};

type ItemLevelInput = {
  itemId: string;
  level: number;
  upgradeCost: number | null;
  imageUrl: string;
};

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const adminPath = "/admin/black-market";

async function isAdmin() {
  return (await getCurrentAccount())?.role === "admin";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  if (!isRecord(input)) return false;
  return (
    isValidSlug(input.id) &&
    typeof input.name === "string" &&
    input.name.trim().length > 0 &&
    input.name.trim().length <= 100 &&
    typeof input.group === "string" &&
    /^[a-z0-9_-]{1,32}$/u.test(input.group) &&
    typeof input.maxLevel === "number" &&
    Number.isSafeInteger(input.maxLevel) &&
    input.maxLevel >= 1 &&
    input.maxLevel <= 100
  );
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
        starts_at: input.startsAt ? new Date(input.startsAt) : null,
        ends_at: input.endsAt ? new Date(input.endsAt) : null,
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
    const saved = await prisma.blackMarketCrate.updateMany({
      where: { id: crateId },
      data: {
        name: input.name.trim(),
        active: input.active,
        starts_at: input.startsAt ? new Date(input.startsAt) : null,
        ends_at: input.endsAt ? new Date(input.endsAt) : null,
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
    await prisma.blackMarketItem.create({
      data: {
        id: input.id,
        name: input.name.trim(),
        group: input.group,
        max_level: input.maxLevel,
      },
    });
    revalidateItems();
    return { type: "success" };
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
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
    const levelsAboveLimit = await prisma.blackMarketItemLevel.count({
      where: { item_id: itemId, level: { gt: input.maxLevel } },
    });
    if (levelsAboveLimit > 0) return { type: "error", code: "VALIDATION_ERROR" };
    const saved = await prisma.blackMarketItem.updateMany({
      where: { id: itemId },
      data: {
        name: input.name.trim(),
        group: input.group,
        max_level: input.maxLevel,
      },
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
    !isOptionalUrl(input.imageUrl) ||
    typeof input.imageUrl !== "string" ||
    input.imageUrl === ""
  ) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    const item = await prisma.blackMarketItem.findUnique({
      where: { id: input.itemId },
      select: { max_level: true },
    });
    if (!item) return { type: "error", code: "NOT_FOUND" };
    if (input.level > item.max_level) return { type: "error", code: "VALIDATION_ERROR" };
    await prisma.blackMarketItemLevel.upsert({
      where: { item_id_level: { item_id: input.itemId, level: input.level } },
      create: {
        item_id: input.itemId,
        level: input.level,
        upgrade_cost: input.upgradeCost,
        image_url: input.imageUrl,
      },
      update: { upgrade_cost: input.upgradeCost, image_url: input.imageUrl },
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
  weight: number,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!isValidSlug(crateId) || !isValidSlug(itemId) || !Number.isSafeInteger(weight) || weight < 1 || weight > 1_000_000) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    await prisma.blackMarketCrateItem.create({
      data: { crate_id: crateId, item_id: itemId, weight },
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
    console.error("Black Market crate item add failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function updateCrateItemWeight(
  crateId: string,
  itemId: string,
  weight: number,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!isValidSlug(crateId) || !isValidSlug(itemId) || !Number.isSafeInteger(weight) || weight < 1 || weight > 1_000_000) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    const updated = await prisma.blackMarketCrateItem.updateMany({
      where: { crate_id: crateId, item_id: itemId },
      data: { weight },
    });
    if (updated.count !== 1) return { type: "error", code: "NOT_FOUND" };
    revalidatePath(`${adminPath}/crates/${crateId}`);
    return { type: "success" };
  } catch (error) {
    console.error("Black Market crate item weight update failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}

export async function removeItemFromCrate(
  crateId: string,
  itemId: string,
): Promise<AdminActionResult> {
  if (!(await isAdmin())) return { type: "error", code: "FORBIDDEN" };
  if (!isValidSlug(crateId) || !isValidSlug(itemId)) {
    return { type: "error", code: "VALIDATION_ERROR" };
  }
  try {
    const removed = await prisma.blackMarketCrateItem.deleteMany({
      where: { crate_id: crateId, item_id: itemId },
    });
    if (removed.count !== 1) return { type: "error", code: "NOT_FOUND" };
    revalidatePath(`${adminPath}/crates/${crateId}`);
    return { type: "success" };
  } catch (error) {
    console.error("Black Market crate item removal failed:", error);
    return { type: "error", code: "INTERNAL_ERROR" };
  }
}
