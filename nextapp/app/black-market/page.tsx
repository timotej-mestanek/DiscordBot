import { getCurrentAccount } from "@/lib/auth/session";
import { getAccountPointBalances } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/app/AppHeader";
import ShopCatalog from "@/app/shop/ShopCatalog";

export default async function BlackMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const account = await getCurrentAccount();
  const params = await searchParams;
  const adminView = account?.role === "admin" && params.view === "admin";
  const identities = account?.identities ?? [];
  const now = new Date();
  const [balances, products, season] = await Promise.all([
    account ? getAccountPointBalances(identities) : Promise.resolve(null),
    prisma.shopProduct.findMany({
      where: {
        active: true,
        product_type: { in: ["black_market_crate", "black_market_key"] },
      },
      orderBy: { name: "asc" },
      include: {
        black_market_crate: {
          select: {
            id: true,
            name: true,
            preview_image_url: true,
            active: true,
            starts_at: true,
            ends_at: true,
            items: {
              include: {
                item: {
                  select: {
                    name: true,
                    item_type: true,
                    expiry: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.blackMarketCrate.findFirst({
      where: {
        active: true,
        ends_at: { gt: now },
        OR: [{ starts_at: null }, { starts_at: { lte: now } }],
      },
      orderBy: { ends_at: "desc" },
      select: { ends_at: true },
    }),
  ]);
  const shopItems = await prisma.blackMarketItem.findMany({
    where: {
      shop_enabled: true,
      item_type: { in: ["normal", "progressive"] },
    },
    orderBy: { name: "asc" },
    include: { levels: { where: { level: 1 }, select: { image_url: true } } },
  });
  const availableProducts = products.filter((product) => {
    const crate = product.black_market_crate;
    return Boolean(
      crate?.active &&
        (!crate.starts_at || crate.starts_at <= now) &&
        crate.ends_at &&
        crate.ends_at > now,
    );
  });
  const availableShopItems = season && season.ends_at > now ? shopItems : [];

  return (
    <main className="app-page min-h-screen bg-zinc-950 text-white">
      <AppHeader
        account={account}
        section="shop"
        shopTab="blackmarket"
        adminView={adminView}
        adminTab="blackmarket"
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        {availableProducts.length > 0 || availableShopItems.length > 0 ? (
          <ShopCatalog
            layout="black-market"
            products={[
              ...availableProducts.map((product) => ({
                id: product.id,
                name: product.name,
                description: product.description,
                cardColor: product.card_color,
                imageUrl:
                  product.product_type === "black_market_crate"
                    ? product.black_market_crate?.preview_image_url ?? product.image_url
                    : product.image_url,
                discordPrice: product.discord_price,
                twitchPrice: product.twitch_price,
                active: product.active,
                productType: product.product_type,
                blackMarketCrate: product.black_market_crate
                  ? {
                      id: product.black_market_crate.id,
                      name: product.black_market_crate.name,
                    }
                  : null,
                blackMarketCrateRewards: product.black_market_crate?.items.map(
                  (entry) => ({
                    name: entry.item.name,
                    itemType: entry.item.item_type,
                    expiry: entry.item.expiry,
                    dropChance: Number(entry.drop_chance),
                    goldenEggs: entry.golden_eggs,
                  }),
                ),
                addToInventory: product.add_to_inventory,
              })),
              ...availableShopItems.map((item) => ({
                id: item.id,
                name: item.name,
                description: "",
                cardColor: "#7c3aed",
                imageUrl: item.image_url ?? item.levels[0]?.image_url ?? null,
                discordPrice: item.shop_discord_price,
                twitchPrice: item.shop_twitch_price,
                active: true,
                productType: "black_market_item" as const,
                blackMarketCrate: null,
                addToInventory: false,
                blackMarketItemExpiry: item.expiry,
              })),
            ].sort((left, right) => left.name.localeCompare(right.name))}
            balances={
              balances
                ? {
                    discord: balances.discord,
                    twitch: balances.twitchCustom,
                  }
                : null
            }
            linked={
              account
                ? {
                    discord: identities.some(
                      (identity) => identity.provider === "discord",
                    ),
                    twitch: identities.some(
                      (identity) => identity.provider === "twitch",
                    ),
                  }
                : null
            }
            quantities={{}}
            isLoggedIn={Boolean(account)}
          />
        ) : (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
            No Blackmarket products are currently available.
          </p>
        )}
      </div>
    </main>
  );
}
