import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import BlackMarketClient from "@/components/black-market/BlackMarketClient";

export default async function BlackMarketPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const now = new Date();
  const [accountData, crates, ownedItems] = await Promise.all([
    prisma.webAccount.findUniqueOrThrow({
      where: { id: account.id },
      select: { golden_eggs: true },
    }),
    prisma.blackMarketCrate.findMany({
      where: {
        active: true,
        AND: [
          { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
          { OR: [{ ends_at: null }, { ends_at: { gte: now } }] },
        ],
      },
      orderBy: { name: "asc" },
      include: {
        inventories: {
          where: { account_id: account.id },
          select: { quantity: true },
        },
      },
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
  const inventory = ownedItems.map((entry) => {
    return {
      id: entry.item.id,
      name: entry.item.name,
      group: entry.group,
      maxLevel: entry.item.max_level,
      currentLevel: entry.current_level,
      isEquipped: entry.is_equipped,
      levels: entry.item.levels.map((level) => ({
        level: level.level,
        imageUrl: level.image_url,
        upgradeCost: level.upgrade_cost,
      })),
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
          initialGoldenEggs={accountData.golden_eggs}
          initialCrates={crates.map((crate) => ({
            id: crate.id,
            name: crate.name,
            previewImageUrl: crate.preview_image_url,
            quantity: crate.inventories[0]?.quantity ?? 0,
          }))}
          initialInventory={inventory}
        />
      </div>
    </main>
  );
}
