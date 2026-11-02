import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import BlackMarketClient from "@/components/black-market/BlackMarketClient";

export default async function BlackMarketPage() {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const now = new Date();
  await prisma.blackMarketInventory.updateMany({
    where: {
      account_id: account.id,
      is_equipped: true,
      expires_at: { lte: now },
    },
    data: { is_equipped: false },
  });
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
          { ends_at: { gt: now } },
        ],
      },
      orderBy: { name: "asc" },
      include: {
        inventories: {
          where: { account_id: account.id },
          select: { quantity: true },
        },
        key_inventories: {
          where: { account_id: account.id },
          select: { quantity: true },
        },
      },
    }),
    prisma.blackMarketInventory.findMany({
      where: {
        account_id: account.id,
        OR: [{ expires_at: null }, { expires_at: { gt: now } }],
        item: { item_type: { not: "golden_eggs" } },
      },
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
  const inventory = ownedItems.flatMap((entry) => {
    if (entry.item.item_type === "golden_eggs") return [];
    return [{
      id: entry.item.id,
      name: entry.item.name,
      group: entry.group,
      itemType: entry.item.item_type,
      imageUrl:
        (entry.item.item_type === "progressive"
          ? entry.item.levels.find((level) => level.level === entry.current_level)?.image_url
          : entry.item.image_url) ??
        "",
      maxLevel: entry.item.max_level,
      currentLevel: entry.current_level,
      isEquipped: entry.is_equipped,
      expiresAt: entry.expires_at?.toISOString() ?? null,
      levels: entry.item.levels.map((level) => ({
        level: level.level,
        imageUrl: level.image_url,
        upgradeCost: level.upgrade_cost,
      })),
    }];
  });

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-black tracking-widest">
            N4JT
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/shop" className="text-sm font-semibold text-violet-300 hover:text-violet-200">
              Shop
            </Link>
            <Link
              href="/dashboard"
              className="text-sm font-semibold text-zinc-300 hover:text-white"
            >
              Dashboard
            </Link>
          </div>
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
            textureUrl: crate.texture_url,
            quantity: crate.inventories[0]?.quantity ?? 0,
            requiresKey: crate.requires_key,
            keyQuantity: crate.key_inventories[0]?.quantity ?? 0,
          }))}
          initialInventory={inventory}
        />
      </div>
    </main>
  );
}
