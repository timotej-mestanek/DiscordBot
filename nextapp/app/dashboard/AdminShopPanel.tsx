import { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ShopAdminManager from "@/app/shop/ShopAdminManager";
import type { AdminShopProduct } from "@/app/shop/ShopAdminManager";

function isMissingShopTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export default async function AdminShopPanel() {
  let products: AdminShopProduct[];
  try {
    products = await prisma.shopProduct.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: { select: { inventory: true, redemptions: true } },
      },
    });
  } catch (error) {
    if (!isMissingShopTable(error)) throw error;
    console.error("Shop tables are missing; apply pending Prisma migrations:", error);
    return (
      <section className="rounded-xl border border-amber-900 bg-amber-950/40 p-5">
        <h2 className="font-semibold text-amber-100">
          Shop potřebuje databázovou migraci
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          V databázi chybí tabulky shopu. Spusť{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5">
            pnpm exec prisma migrate deploy
          </code>{" "}
          a obnov stránku.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-900/60 bg-violet-950/20 p-5">
        <div>
          <h2 className="font-semibold">Správa položek shopu</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Uprav nabídku a nastavení produktů. Uživatelský náhled je dostupný zvlášť.
          </p>
        </div>
        <Link
          href="/shop?preview=public"
          className="rounded-lg border border-violet-700 px-4 py-2 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-900/40"
        >
          Náhled jako uživatel
        </Link>
      </div>
      <ShopAdminManager products={products} />
    </div>
  );
}
