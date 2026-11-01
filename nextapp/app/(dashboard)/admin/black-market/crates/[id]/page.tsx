import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import CrateItemsManager from "./CrateItemsManager";

export default async function BlackMarketCrateItemsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const crate = await prisma.blackMarketCrate.findUnique({
    where: { id },
    include: {
      items: {
        orderBy: { item: { name: "asc" } },
        include: {
          item: { select: { id: true, name: true, item_type: true } },
        },
      },
    },
  });
  if (!crate) notFound();

  const availableItems = await prisma.blackMarketItem.findMany({
    where: {
      OR: [
        { item_type: "golden_eggs" },
        { crates: { none: { crate_id: id } } },
      ],
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, item_type: true },
  });
  const totalChance = crate.items.reduce(
    (total, entry) => total + Number(entry.drop_chance),
    0,
  );

  return (
    <section>
      <div className="mb-7">
        <Link href="/admin/black-market/crates" className="text-sm text-violet-300 hover:text-violet-200">
          ← All crates
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{crate.name} items</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {crate.id} · total drop chance {totalChance.toFixed(2)}%
        </p>
      </div>
      <CrateItemsManager
        crateId={crate.id}
        totalChance={totalChance}
        items={crate.items.map((entry) => ({
          crateItemId: entry.id,
          name: entry.item.name,
          itemType: entry.item.item_type,
          dropChance: Number(entry.drop_chance),
          goldenEggs: entry.golden_eggs,
        }))}
        availableItems={availableItems}
      />
    </section>
  );
}
