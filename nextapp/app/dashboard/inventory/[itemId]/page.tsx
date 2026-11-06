import { notFound, redirect } from "next/navigation";
import AppHeader from "@/app/AppHeader";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import ProgressiveItemUpgrade from "./ProgressiveItemUpgrade";

export default async function ProgressiveItemUpgradePage({
  params,
}: {
  params: Promise<{ itemId: string }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const { itemId } = await params;
  const [owned, accountBalance] = await Promise.all([
    prisma.blackMarketInventory.findUnique({
      where: {
        account_id_item_id: { account_id: account.id, item_id: itemId },
      },
      include: {
        item: {
          include: { levels: { orderBy: { level: "asc" } } },
        },
      },
    }),
    prisma.webAccount.findUnique({
      where: { id: account.id },
      select: { golden_eggs: true },
    }),
  ]);
  if (
    !owned ||
    (owned.expires_at && owned.expires_at <= new Date()) ||
    owned.item.item_type !== "progressive"
  ) {
    notFound();
  }
  if (!accountBalance) notFound();

  return (
    <main className="app-page min-h-screen bg-zinc-950 text-white">
      <AppHeader account={account} section="inventory" />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <ProgressiveItemUpgrade
          accountId={account.id}
          item={{
            id: owned.item.id,
            name: owned.item.name,
            currentLevel: owned.current_level,
            maxLevel: owned.item.max_level,
            levels: owned.item.levels.map((level) => ({
              level: level.level,
              imageUrl: level.image_url,
              upgradeCost: level.upgrade_cost,
              description: level.description,
            })),
          }}
          initialGoldenEggs={accountBalance.golden_eggs}
        />
      </div>
    </main>
  );
}
