import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import BlackMarketClient from "./BlackMarketClient";

export default async function BlackMarketPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const now = new Date();
  const [crates, crateInventory, ownedItems] = await Promise.all([
    prisma.blackMarketCrate.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
          { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
        ],
      },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.blackMarketCrateInventory.findMany({
      where: { account_id: account.id, quantity: { gt: 0 } },
      select: { crate_id: true, quantity: true },
    }),
    prisma.blackMarketInventory.findMany({
      where: { account_id: account.id },
      orderBy: [{ group: "asc" }, { item: { name: "asc" } }],
      include: {
        item: {
          include: {
            levels: { orderBy: { level: "asc" } },
          },
        },
      },
    }),
  ]);
  const quantities = new Map(
    crateInventory.map((entry) => [entry.crate_id, entry.quantity]),
  );
  const inventory = ownedItems.map((entry) => {
    const current = entry.item.levels.find(
      (level) => level.level === entry.current_level,
    );
    const next = entry.item.levels.find(
      (level) => level.level === entry.current_level + 1,
    );
    return {
      id: entry.item.id,
      name: entry.item.name,
      group: entry.group,
      maxLevel: entry.item.max_level,
      currentLevel: entry.current_level,
      equipped: entry.is_equipped,
      imageUrl: current?.image_url ?? "",
      levels: entry.item.levels.map((level) => ({
        level: level.level,
        cost: level.upgrade_cost,
        imageUrl: level.image_url,
      })),
      nextLevel: next
        ? {
            level: next.level,
            cost: next.upgrade_cost,
            imageUrl: next.image_url,
          }
        : null,
    };
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-black tracking-widest">
            N4JT
          </Link>
          <Link
            href="/dashboard"
            className="text-sm font-semibold text-zinc-300 hover:text-white"
          >
            Dashboard
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <BlackMarketClient
          accountId={account.id}
          initialGoldenEggs={account.golden_eggs}
          crates={crates.map((crate) => ({
            ...crate,
            quantity: quantities.get(crate.id) ?? 0,
          }))}
          initialInventory={inventory}
        />
      </div>
    </main>
  );
}
