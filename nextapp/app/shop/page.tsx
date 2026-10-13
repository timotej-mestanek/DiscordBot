import { Prisma } from "@prisma/client";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import { getAccountPointBalances } from "@/lib/points";
import { prisma } from "@/lib/prisma";
import ShopAdminManager from "./ShopAdminManager";
import type { AdminShopProduct } from "./ShopAdminManager";
import ShopProductCard from "./ShopProductCard";

function isMissingShopTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export default async function ShopPage() {
  const account = await getCurrentAccount();
  const identities = account?.identities ?? [];
  const balances = account ? await getAccountPointBalances(identities) : null;
  let products: AdminShopProduct[] = [];
  let inventoryByProduct = new Map<string, number>();
  let shopTablesReady = true;

  try {
    products = await prisma.shopProduct.findMany({
      where: account?.role === "admin" ? {} : { active: true },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { inventory: true, redemptions: true } },
      },
    });
    if (account) {
      const inventory = await prisma.shopInventory.findMany({
        where: { account_id: account.id, quantity: { gt: 0 } },
        select: { product_id: true, quantity: true },
      });
      inventoryByProduct = new Map(
        inventory.map((entry) => [entry.product_id, entry.quantity]),
      );
    }
  } catch (error) {
    if (!isMissingShopTable(error)) throw error;
    console.error("Shop tables are missing; apply pending Prisma migrations:", error);
    shopTablesReady = false;
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-black tracking-widest">N4JT</Link>
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-semibold text-zinc-300 hover:text-white">
              Dashboard
            </Link>
            <Link
              href={account ? "/dashboard?tab=leds" : "/login"}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500"
            >
              LEDS
            </Link>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">
          Komunitní shop
        </p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Shop</h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Nakup položky za Discord body nebo Twitch CustomBody. Podle nastavení se položka použije hned,
          nebo se uloží do inventáře.
        </p>

        {!shopTablesReady ? (
          <section className="mt-8 rounded-xl border border-amber-900 bg-amber-950/40 p-5">
            <h2 className="font-semibold text-amber-100">Shop potřebuje databázovou migraci</h2>
            <p className="mt-2 text-sm leading-6 text-amber-100/80">
              Shop zatím není dostupný, protože v databázi chybí jeho tabulky. Spusť
              {" "}<code className="rounded bg-black/30 px-1.5 py-0.5">pnpm exec prisma migrate deploy</code>
              {" "}a obnov stránku.
            </p>
          </section>
        ) : (
          <>
            {account?.role === "admin" && (
              <ShopAdminManager products={products} />
            )}
            <section className="mt-8 grid gap-5 lg:grid-cols-2">
              {products
                .filter((product) => product.active)
                .map((product) => (
                  <ShopProductCard
                    key={product.id}
                    product={{
                      id: product.id,
                      name: product.name,
                      description: product.description,
                      discordPrice: product.discord_price,
                      twitchPrice: product.twitch_price,
                      active: product.active,
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
                      product.add_to_inventory
                        ? inventoryByProduct.get(product.id) ?? 0
                        : 0
                    }
                    isLoggedIn={Boolean(account)}
                  />
                ))}
            </section>
            {products.every((product) => !product.active) && (
              <p className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
                {account?.role === "admin"
                  ? "Vytvoř modul v administraci shopu níže a zapni jeho prodej."
                  : "Momentálně nejsou v prodeji žádné moduly."}
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
