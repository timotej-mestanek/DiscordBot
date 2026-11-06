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

export async function purchaseShopProduct(input: {
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
        product_type: true,
        black_market_crate_id: true,
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

    let blackMarketCrateId: string | null = null;
    if (product.product_type !== "standard") {
      blackMarketCrateId = product.black_market_crate_id;
      if (!blackMarketCrateId) {
        throw new ShopActionError("Tento Black Market produkt není správně nastaven.");
      }
      const crate = await transaction.blackMarketCrate.findUnique({
        where: { id: blackMarketCrateId },
        select: { active: true, starts_at: true, ends_at: true, requires_key: true },
      });
      const now = new Date();
      if (
        !crate ||
        !crate.active ||
        (crate.starts_at !== null && crate.starts_at > now) ||
        crate.ends_at <= now
      ) {
        throw new ShopActionError("Tato bedna už není momentálně dostupná.");
      }
      if (product.product_type === "black_market_key" && !crate.requires_key) {
        throw new ShopActionError("Tato bedna nevyžaduje klíč.");
      }
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
    let blackMarketQuantity = 0;
    let redemptionId: string | null = null;
    let deliveryEventId: string | null = null;
    if (product.product_type === "black_market_crate" && blackMarketCrateId) {
      const inventory = await transaction.blackMarketCrateInventory.upsert({
        where: {
          account_id_crate_id: {
            account_id: input.accountId,
            crate_id: blackMarketCrateId,
          },
        },
        create: {
          account_id: input.accountId,
          crate_id: blackMarketCrateId,
          quantity: 1,
        },
        update: { quantity: { increment: 1 } },
        select: { quantity: true },
      });
      blackMarketQuantity = inventory.quantity;
    } else if (product.product_type === "black_market_key" && blackMarketCrateId) {
      const inventory = await transaction.blackMarketKeyInventory.upsert({
        where: {
          account_id_crate_id: {
            account_id: input.accountId,
            crate_id: blackMarketCrateId,
          },
        },
        create: {
          account_id: input.accountId,
          crate_id: blackMarketCrateId,
          quantity: 1,
        },
        update: { quantity: { increment: 1 } },
        select: { quantity: true },
      });
      blackMarketQuantity = inventory.quantity;
    } else if (product.product_type === "standard" && product.add_to_inventory) {
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
    const inventorySnapshot = product.product_type === "standard"
      ? await transaction.shopInventory.findUnique({
          where: {
            account_id_product_id: {
              account_id: input.accountId,
              product_id: product.id,
            },
          },
          select: { quantity: true },
        })
      : null;
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
          productType: product.product_type,
          blackMarketCrateId,
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
      blackMarketType: product.product_type === "standard" ? null : product.product_type,
      blackMarketQuantity,
    };
  });
}

export async function purchaseBlackMarketItem(input: {
  accountId: string;
  identities: Identity[];
  currency: SupportedPointCurrency;
  itemId: string;
}) {
  const identity = input.identities.find((item) => getProvider(item, input.currency));
  if (!identity) {
    throw new ShopActionError(
      `Pro platbu v měně ${input.currency === "discord" ? "Discord" : "Twitch"} nejdřív propoj odpovídající účet.`,
    );
  }

  return prisma.$transaction(async (transaction) => {
    const item = await transaction.blackMarketItem.findUnique({
      where: { id: input.itemId },
      select: {
        id: true,
        name: true,
        group: true,
        item_type: true,
        expiry: true,
        shop_enabled: true,
        shop_discord_price: true,
        shop_twitch_price: true,
      },
    });
    const now = new Date();
    const season = await transaction.blackMarketCrate.findFirst({
      where: {
        active: true,
        ends_at: { gt: now },
        OR: [{ starts_at: null }, { starts_at: { lte: now } }],
      },
      orderBy: { ends_at: "desc" },
      select: { ends_at: true },
    });
    if (
      !item ||
      item.item_type === "golden_eggs" ||
      !item.shop_enabled ||
      !season
    ) {
      throw new ShopActionError("Tento Black Market item už není dostupný.");
    }

    const price =
      input.currency === "discord"
        ? item.shop_discord_price
        : item.shop_twitch_price;
    if (price === null || price <= 0) {
      throw new ShopActionError("Tato měna není pro tento item dostupná.");
    }

    const owned = await transaction.blackMarketInventory.findUnique({
      where: {
        account_id_item_id: {
          account_id: input.accountId,
          item_id: item.id,
        },
      },
      select: { expires_at: true },
    });
    if (owned && (!owned.expires_at || owned.expires_at > now)) {
      throw new ShopActionError("Tento item už máš ve svém inventáři.");
    }

    const expiresAt =
      item.expiry === "seven_days"
        ? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
        : item.expiry === "thirty_days"
          ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
          : item.expiry === "event_end"
            ? season.ends_at
            : null;
    const autoEquipped = item.expiry === "event_end";

    await changePointBalance(
      transaction,
      input.currency,
      identity.provider_user_id,
      -price,
      `Black Market: ${item.name}`,
      input.accountId,
    );
    if (autoEquipped) {
      await transaction.blackMarketInventory.updateMany({
        where: {
          account_id: input.accountId,
          group: item.group,
          is_equipped: true,
        },
        data: { is_equipped: false },
      });
    }

    const inventoryData = {
      group: item.group,
      current_level: 1,
      is_equipped: autoEquipped,
      use_input: null,
      expires_at: expiresAt,
    };
    if (owned) {
      await transaction.blackMarketInventory.update({
        where: {
          account_id_item_id: {
            account_id: input.accountId,
            item_id: item.id,
          },
        },
        data: inventoryData,
      });
    } else {
      await transaction.blackMarketInventory.create({
        data: {
          account_id: input.accountId,
          item_id: item.id,
          ...inventoryData,
        },
      });
    }

    await transaction.adminAuditLog.create({
      data: {
        actor_account_id: input.accountId,
        target_account_id: input.accountId,
        action: "black_market.item_purchased",
        details: {
          itemId: item.id,
          currency: input.currency,
          price,
          providerUserId: identity.provider_user_id,
          expiresAt: expiresAt?.toISOString() ?? null,
          autoEquipped,
        },
      },
    });
    return { autoEquipped, expiresAt: expiresAt?.toISOString() ?? null };
  });
}

export async function redeemShopProduct(input: {
  accountId: string;
  identities: Identity[];
  productId: string;
  userInput: string | null;
}) {
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.shopProduct.findUnique({
      where: { id: input.productId },
      select: {
        id: true,
        name: true,
        description: true,
        product_type: true,
        add_to_inventory: true,
        activation_input_label: true,
        streamerbot_action: true,
      },
    });
    if (!product || product.id === "custom-led-effect" || product.product_type !== "standard") {
      throw new ShopActionError("This item cannot be redeemed from the shop.");
    }
    if (
      product.activation_input_label
        ? input.userInput === null ||
          input.userInput.trim().length === 0 ||
          input.userInput.length > 500
        : input.userInput !== null
    ) {
      throw new ShopActionError(
        product.activation_input_label
          ? `Enter the requested value: ${product.activation_input_label}`
          : "This item does not accept additional input.",
      );
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
      ...(input.userInput === null ? {} : { userInput: input.userInput.trim() }),
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
  identities: Identity[];
  effect: Prisma.InputJsonValue;
}) {
  return prisma.$transaction(async (transaction) => {
    const product = await transaction.shopProduct.findUnique({
      where: { id: "custom-led-effect" },
      select: {
        id: true,
        name: true,
        description: true,
        streamerbot_action: true,
      },
    });
    if (!product) {
      throw new ShopActionError("Custom LED effect shop product is not configured.");
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
      throw new ShopActionError("Nemáš žádné použití Custom LED effect. Kup ho v shopu.");
    }

    const redemption = await transaction.shopRedemption.create({
      data: {
        account_id: input.accountId,
        product_id: product.id,
        effect: input.effect,
      },
      select: { id: true },
    });
    const deliveryEventId = await queueShopDelivery(transaction, {
      accountId: input.accountId,
      identity,
      payment: null,
      product,
      redemptionId: redemption.id,
      effect: input.effect,
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
        details: {
          productId: product.id,
          redemptionId: redemption.id,
          deliveryEventId,
        },
      },
    });
    return {
      quantity: remaining?.quantity ?? 0,
      deliveryEventId,
    };
  });
}
