import { Prisma } from "@prisma/client";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAdminShopDeliveries } from "@/lib/shop-admin";
import ShopAdminManager from "@/app/shop/ShopAdminManager";
import type {
  AdminShopDelivery,
  AdminShopProduct,
} from "@/app/shop/ShopAdminManager";

function isMissingShopTable(error: unknown) {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2021"
  );
}

export default async function AdminShopPanel() {
  let products: AdminShopProduct[];
  let deliveries: AdminShopDelivery[];
  try {
    [products, deliveries] = await Promise.all([
      prisma.shopProduct.findMany({
        orderBy: { name: "asc" },
        include: {
          _count: { select: { inventory: true, redemptions: true } },
        },
      }),
      getAdminShopDeliveries(),
    ]);
  } catch (error) {
    if (!isMissingShopTable(error)) throw error;
    console.error("Shop tables are missing; apply pending Prisma migrations:", error);
    return (
      <section className="rounded-xl border border-amber-900 bg-amber-950/40 p-5">
        <h2 className="font-semibold text-amber-100">
          The shop requires a database migration
        </h2>
        <p className="mt-2 text-sm leading-6 text-amber-100/80">
          The shop tables are missing from the database. Run{" "}
          <code className="rounded bg-black/30 px-1.5 py-0.5">
            pnpm exec prisma migrate deploy
          </code>{" "}
          and reload the page.
        </p>
      </section>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-900/60 bg-violet-950/20 p-5">
        <div>
          <h2 className="font-semibold">Manage shop products</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Edit products and their settings. The public preview is available separately.
          </p>
        </div>
        <Link
          href="/shop?preview=public"
          className="rounded-lg border border-violet-700 px-4 py-2 text-sm font-semibold text-violet-200 transition-colors hover:bg-violet-900/40"
        >
          Preview as a user
        </Link>
      </div>
      <ShopAdminManager products={products} deliveries={deliveries} />
    </div>
  );
}
