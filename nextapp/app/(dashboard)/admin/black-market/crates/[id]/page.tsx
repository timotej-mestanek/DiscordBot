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
        include: { item: { select: { id: true, name: true } } },
      },
    },
  });
  if (!crate) notFound();

  const availableItems = await prisma.blackMarketItem.findMany({
    where: { crates: { none: { crate_id: id } } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  const totalWeight = crate.items.reduce((total, entry) => total + entry.weight, 0);

  return (
    <section>
      <div className="mb-7">
        <Link href="/admin/black-market/crates" className="text-sm text-violet-300 hover:text-violet-200">
          ← All crates
        </Link>
        <h1 className="mt-3 text-3xl font-bold">{crate.name} items</h1>
        <p className="mt-2 text-sm text-zinc-400">
          {crate.id} · total drop weight {totalWeight}
        </p>
      </div>
      <CrateItemsManager
        crateId={crate.id}
        totalWeight={totalWeight}
        items={crate.items.map((entry) => ({
          id: entry.item.id,
          name: entry.item.name,
          weight: entry.weight,
        }))}
        availableItems={availableItems}
      />
    </section>
  );
}
