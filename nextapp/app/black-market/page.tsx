import { getCurrentAccount } from "@/lib/auth/session";
import { getAccountPointBalances } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import AppHeader from "@/app/AppHeader";
import PointBalanceSummary from "@/app/PointBalanceSummary";
import ShopProductCard from "@/app/shop/ShopProductCard";

export default async function BlackMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const account = await getCurrentAccount();
  const params = await searchParams;
  const adminView = account?.role === "admin" && params.view === "admin";
  const identities = account?.identities ?? [];
  const [balances, products] = await Promise.all([
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
            active: true,
            starts_at: true,
            ends_at: true,
          },
        },
      },
    }),
  ]);
  const now = new Date();
  const availableProducts = products.filter((product) => {
    const crate = product.black_market_crate;
    return Boolean(
      crate?.active &&
        (!crate.starts_at || crate.starts_at <= now) &&
        crate.ends_at &&
        crate.ends_at > now,
    );
  });

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
        <header className="mb-5">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
            Crates · keys · drops
          </p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">
            Blackmarket Shop
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-400">
            Browse crates and keys. Purchased crates are stored in your Inventory warehouse.
          </p>
        </header>

        {balances && (
          <PointBalanceSummary
            className="mb-5 rounded-xl border border-zinc-800 bg-zinc-900/70 p-2"
            balances={{
              discord: balances.discord,
              twitchCustom: balances.twitchCustom,
            }}
          />
        )}

        {availableProducts.length > 0 ? (
          <section className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {availableProducts.map((product) => (
              <ShopProductCard
                key={product.id}
                product={{
                  id: product.id,
                  name: product.name,
                  description: product.description,
                  cardColor: product.card_color,
                  imageUrl: product.image_url,
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
                  addToInventory: product.add_to_inventory,
                }}
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
                quantity={0}
                isLoggedIn={Boolean(account)}
              />
            ))}
          </section>
        ) : (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
            No Blackmarket crates or keys are currently available.
          </p>
        )}
      </div>
    </main>
  );
}
