import { Prisma } from "@prisma/client";
import { getCurrentAccount } from "@/lib/auth/session";
import { getAccountPointBalances } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { getAdminShopDeliveries } from "@/lib/shop-admin";
import AppHeader from "@/app/AppHeader";
import PointBalanceSummary from "@/app/PointBalanceSummary";
import ShopAdminManager from "./ShopAdminManager";
import type {
  AdminShopCrate,
  AdminShopDelivery,
  AdminShopProduct,
} from "./ShopAdminManager";
import ShopProductCard from "./ShopProductCard";

function isMissingShopTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ preview?: string; view?: string }>;
}) {
  const account = await getCurrentAccount();
  const params = await searchParams;
  const isPublicPreview = account?.role === "admin" && params.preview === "public";
  const adminView =
    account?.role === "admin" &&
    !isPublicPreview &&
    params.view === "admin";
  const identities = account?.identities ?? [];
  const balances = account ? await getAccountPointBalances(identities) : null;
  let products: AdminShopProduct[] = [];
  let deliveries: AdminShopDelivery[] = [];
  let crates: AdminShopCrate[] = [];
  let inventoryByProduct = new Map<string, number>();
  let shopTablesReady = true;

  try {
    [products, crates] = await Promise.all([
      prisma.shopProduct.findMany({
      where: adminView ? {} : { active: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { inventory: true, redemptions: true } },
        black_market_crate: {
          select: { id: true, name: true, requires_key: true, active: true, starts_at: true, ends_at: true },
        },
      },
      }),
      prisma.blackMarketCrate.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true, requires_key: true },
      }),
    ]);
    if (account) {
      const inventory = await prisma.shopInventory.findMany({
        where: { account_id: account.id, quantity: { gt: 0 } },
        select: { product_id: true, quantity: true },
      });
      inventoryByProduct = new Map(
        inventory.map((entry) => [entry.product_id, entry.quantity]),
      );
    }
    if (adminView) {
      deliveries = await getAdminShopDeliveries();
    }
  } catch (error) {
    if (!isMissingShopTable(error)) throw error;
    console.error("Shop tables are missing; apply pending Prisma migrations:", error);
    shopTablesReady = false;
  }

  return (
    <main className="app-page min-h-screen bg-zinc-950 text-white">
      <AppHeader
        account={account}
        section="shop"
        shopTab="default"
        adminView={adminView}
        adminTab="shop"
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <h1 className="app-page-title text-2xl font-black tracking-tight sm:text-3xl">
          {adminView ? "Shop management" : "Shop"}
        </h1>
        {isPublicPreview && (
          <p className="mt-3 rounded-md border border-violet-900/60 bg-violet-950/20 p-2 text-xs text-violet-200">
            Public preview · inactive products and admin tools are hidden.
          </p>
        )}

        {!shopTablesReady ? (
          <section className="mt-5 rounded-lg border border-amber-900 bg-amber-950/40 p-4">
            <h2 className="font-semibold text-amber-100">The shop requires a database migration</h2>
            <p className="mt-2 text-sm leading-6 text-amber-100/80">
              The shop is unavailable because its database tables are missing. Run
              {" "}<code className="rounded bg-black/30 px-1.5 py-0.5">pnpm exec prisma migrate deploy</code>
              {" "}and reload the page.
            </p>
          </section>
        ) : (
          <>
            {adminView && (
              <ShopAdminManager
                products={products}
                deliveries={deliveries}
                crates={crates}
              />
            )}
            {!adminView && (
              <>
                {account && (
                  <section className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-800 bg-zinc-900/70 p-3">
                    <PointBalanceSummary
                      balances={{
                        discord: balances?.discord ?? null,
                        twitchCustom: balances?.twitchCustom ?? null,
                      }}
                    />
                    <p className="text-xs font-medium text-zinc-400">
                      Inventory:{" "}
                      <strong className="text-zinc-200">
                        {[...inventoryByProduct.values()].reduce((total, quantity) => total + quantity, 0)} items
                      </strong>
                    </p>
                  </section>
                )}
                <section className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products
                .filter((product) => {
                  if (!product.active) {
                    return (
                      product.product_type === "standard" &&
                      product.id === "custom-led-effect" &&
                      (inventoryByProduct.get(product.id) ?? 0) > 0
                    );
                  }
                  return product.product_type === "standard";
                })
                .map((product) => (
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
                        ? { id: product.black_market_crate.id, name: product.black_market_crate.name }
                        : null,
                      addToInventory: product.add_to_inventory,
                    }}
                    balances={
                      balances
                        ? { discord: balances.discord, twitch: balances.twitchCustom }
                        : null
                    }
                    linked={
                      account
                        ? {
                            discord: identities.some((item) => item.provider === "discord"),
                            twitch: identities.some((item) => item.provider === "twitch"),
                          }
                        : null
                    }
                    quantity={
                      inventoryByProduct.get(product.id) ?? 0
                    }
                    isLoggedIn={Boolean(account)}
                  />
                ))}
                </section>
                {!products.some(
                  (product) =>
                    (product.active && product.product_type === "standard") ||
                    (product.product_type === "standard" &&
                      product.id === "custom-led-effect" &&
                      (inventoryByProduct.get(product.id) ?? 0) > 0),
                ) && (
                  <p className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
                    No products are currently available.
                  </p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </main>
  );
}
