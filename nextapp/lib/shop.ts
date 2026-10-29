import { prisma } from "@/lib/prisma";
import { changePointBalance } from "@/lib/points";
import type { SupportedPointCurrency } from "@/lib/points";
import type { Prisma } from "@prisma/client";

type Identity = {
  provider: string;
  provider_user_id: string;
  display_name?: string;
};

export class ShopActionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShopActionError";
  }
}

function getProvider(identity: Identity, currency: SupportedPointCurrency) {
  return currency === "discord"
    ? identity.provider === "discord"
    : identity.provider === "twitch";
}

async function queueShopDelivery(
  transaction: Prisma.TransactionClient,
  input: {
    accountId: string;
    identity: Identity;
    payment: { currency: SupportedPointCurrency; amount: number } | null;
    product: {
      id: string;
      name: string;
      description: string;
      streamerbot_action: string;
    };
    redemptionId: string;
    effect: Prisma.InputJsonValue;
  },
) {
  const eventId = crypto.randomUUID();
  const account = await transaction.webAccount.findUniqueOrThrow({
    where: { id: input.accountId },
    select: { display_name: true },
  });
  const payload = {
    type: "shop-redemption",
    eventId,
    actionKey: input.product.streamerbot_action,
    product: {
      id: input.product.id,
      name: input.product.name,
      description: input.product.description,
    },
    redemptionId: input.redemptionId,
    account: {
      id: input.accountId,
      displayName: account.display_name,
    },
    buyer: {
      provider: input.identity.provider,
      providerUserId: input.identity.provider_user_id,
      displayName: input.identity.display_name ?? account.display_name,
    },
    payment: input.payment,
    effect: input.effect,
  } satisfies Prisma.InputJsonObject;

  await transaction.shopDeliveryEvent.create({
    data: {
      event_id: eventId,
      product_id: input.product.id,
      account_id: input.accountId,
      action_key: input.product.streamerbot_action,
      payload,
    },
  });
  return eventId;
}

export async function purchaseCustomLedEffect(input: {
  accountId: string;
  identities: Identity[];
  currency: SupportedPointCurrency;
  productId: string;
}) {
  const identity = input.identities.find((item) => getProvider(item, input.currency));
  if (!identity) {
    throw new ShopActionError(
      `Pro platbu v měně ${input.currency === "discord" ? "Discord" : "Twitch"} nejdřív propoj odpovídající účet.`,
    );
  }

  return prisma.$transaction(async (transaction) => {
    const product = await transaction.shopProduct.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        description: true,
        active: true,
        add_to_inventory: true,
        streamerbot_action: true,
        discord_price: true,
        twitch_price: true,
      },
    });
    if (!product?.active) {
      throw new ShopActionError("Tento produkt není momentálně dostupný.");
    }
    const price =
      input.currency === "discord" ? product.discord_price : product.twitch_price;
    if (price === null || price <= 0) {
      throw new ShopActionError("Tento způsob platby není momentálně dostupný.");
    }

    await changePointBalance(
      transaction,
      input.currency,
      identity.provider_user_id,
      -price,
      `Shop: ${product.name}`,
      input.accountId,
    );
    let inventoryQuantity = 0;
    let redemptionId: string | null = null;
    let deliveryEventId: string | null = null;
    if (product.add_to_inventory) {
      const inventory = await transaction.shopInventory.upsert({
        where: {
          account_id_product_id: {
            account_id: input.accountId,
            product_id: product.id,
          },
        },
        create: {
          account_id: input.accountId,
          product_id: product.id,
          quantity: 1,
        },
        update: { quantity: { increment: 1 } },
        select: { quantity: true },
      });
      inventoryQuantity = inventory.quantity;
    } else {
      const redemption = await transaction.shopRedemption.create({
        data: {
          account_id: input.accountId,
          product_id: product.id,
          effect: { type: "shop-item", name: product.name, description: product.description },
        },
        select: { id: true },
      });
      redemptionId = redemption.id;
      deliveryEventId = await queueShopDelivery(transaction, {
        accountId: input.accountId,
        identity,
        payment: { currency: input.currency, amount: price },
        product,
        redemptionId,
        effect: {
          type: "shop-item",
          name: product.name,
          description: product.description,
        },
      });
    }

    const providerUserId = identity.provider_user_id;
    const inventorySnapshot = await transaction.shopInventory.findUnique({
      where: {
        account_id_product_id: {
          account_id: input.accountId,
          product_id: product.id,
        },
      },
      select: { quantity: true },
    });
    await transaction.adminAuditLog.create({
      data: {
        actor_account_id: input.accountId,
        target_account_id: input.accountId,
        action: "shop.purchased",
        details: {
          productId: product.id,
          currency: input.currency,
          price,
          providerUserId,
          addToInventory: product.add_to_inventory,
          redemptionId,
          deliveryEventId,
          inventoryQuantityAfter: inventorySnapshot?.quantity ?? 0,
        },
      },
    });
    return {
      quantity: inventoryQuantity,
      addToInventory: product.add_to_inventory,
      deliveryEventId,
    };
  });
}

export async function redeemShopProduct(input: {
  accountId: string;
  identities: Identity[];
  productId: string;
}) {
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.shopProduct.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        description: true,
        add_to_inventory: true,
        streamerbot_action: true,
      },
    });
    if (!product || product.id === "custom-led-effect") {
      throw new ShopActionError("This item cannot be redeemed from the shop.");
    }

    const identity = input.identities.find(
      (item) => item.provider === "discord" || item.provider === "twitch",
    );
    if (!identity) {
      throw new ShopActionError("Link a Discord or Twitch account before redeeming this item.");
    }

    const used = await transaction.shopInventory.updateMany({
      where: {
        account_id: input.accountId,
        product_id: product.id,
        quantity: { gt: 0 },
      },
      data: { quantity: { decrement: 1 } },
    });
    if (used.count !== 1) {
      throw new ShopActionError("You do not have this item in your inventory.");
    }

    const effect = {
      type: "shop-item",
      name: product.name,
      description: product.description,
    } satisfies Prisma.InputJsonObject;
    const redemption = await transaction.shopRedemption.create({
      data: {
        account_id: input.accountId,
        product_id: product.id,
        effect,
      },
      select: { id: true },
    });
    const deliveryEventId = await queueShopDelivery(transaction, {
      accountId: input.accountId,
      identity,
      payment: null,
      product,
      redemptionId: redemption.id,
      effect,
    });
    const remaining = await transaction.shopInventory.findUnique({
      where: {
        account_id_product_id: {
          account_id: input.accountId,
          product_id: product.id,
        },
      },
      select: { quantity: true },
    });
    await transaction.adminAuditLog.create({
      data: {
        actor_account_id: input.accountId,
        target_account_id: input.accountId,
        action: "shop.redeemed",
        details: { productId: product.id, redemptionId: redemption.id, deliveryEventId },
      },
    });

    return {
      quantity: remaining?.quantity ?? 0,
      deliveryEventId,
    };
  });
}

export async function redeemCustomLedEffect(input: {
  accountId: string;
  effect: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (transaction) => {
    const inventory = await transaction.shopInventory.findMany({
      where: { account_id: input.accountId, quantity: { gt: 0 } },
      orderBy: [{ updated_at: "asc" }, { product_id: "asc" }],
      select: { product_id: true },
    });
    if (inventory.length === 0) {
      throw new ShopActionError("Nemáš žádné použití Custom LED effect. Kup ho v shopu.");
    }

    const productId = inventory[0].product_id;
    const used = await transaction.shopInventory.updateMany({
      where: {
        account_id: input.accountId,
        product_id: productId,
        quantity: { gt: 0 },
      },
      data: { quantity: { decrement: 1 } },
    });
    if (used.count !== 1) {
      throw new ShopActionError("Použití efektu už bylo spotřebováno. Obnov stránku.");
    }

    const redemption = await transaction.shopRedemption.create({
      data: {
        account_id: input.accountId,
        product_id: productId,
        effect: input.effect,
      },
      select: { id: true },
    });
    const remaining = await transaction.shopInventory.aggregate({
      where: { account_id: input.accountId },
      _sum: { quantity: true },
    });
    await transaction.adminAuditLog.create({
      data: {
        actor_account_id: input.accountId,
        target_account_id: input.accountId,
        action: "shop.redeemed",
        details: { productId, redemptionId: redemption.id },
      },
    });
    return { quantity: remaining._sum.quantity ?? 0 };
  });
}
