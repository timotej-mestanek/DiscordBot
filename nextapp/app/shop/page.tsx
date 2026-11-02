import { Prisma } from "@prisma/client";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import { getAccountPointBalances } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import { getAdminShopDeliveries } from "@/lib/shop-admin";
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
  searchParams: Promise<{ preview?: string }>;
}) {
  const account = await getCurrentAccount();
  const params = await searchParams;
  const isPublicPreview = account?.role === "admin" && params.preview === "public";
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
      where: account?.role === "admin" && !isPublicPreview ? {} : { active: true },
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
    if (account?.role === "admin" && !isPublicPreview) {
      deliveries = await getAdminShopDeliveries();
    }
  } catch (error) {
    if (!isMissingShopTable(error)) throw error;
    console.error("Shop tables are missing; apply pending Prisma migrations:", error);
    shopTablesReady = false;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2.5 sm:px-6">
          <Link href="/" className="text-lg font-black tracking-widest">N4JT</Link>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm font-semibold text-zinc-300 hover:text-white">
              Dashboard
            </Link>
            <Link
              href={account ? "/dashboard?tab=leds" : "/login"}
              className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-semibold hover:bg-violet-500"
            >
              LEDS
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Shop</h1>
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
            {account?.role === "admin" && !isPublicPreview && (
              <ShopAdminManager
                products={products}
                deliveries={deliveries}
                crates={crates}
              />
            )}
            <section className="mt-5 grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {products
                .filter((product) => {
                  if (!product.active) return false;
                  if (product.product_type === "standard") return true;
                  const crate = product.black_market_crate;
                  const now = new Date();
                  return Boolean(
                    crate?.active &&
                    (!crate.starts_at || crate.starts_at <= now) &&
                    crate.ends_at &&
                    crate.ends_at > now,
                  );
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
            {products.every((product) => !product.active) && (
              <p className="mt-5 rounded-lg border border-zinc-800 bg-zinc-900 p-4 text-sm text-zinc-400">
                {account?.role === "admin" && !isPublicPreview
                  ? "Create a product in the shop admin section below and enable it."
                  : "No products are currently available."}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
