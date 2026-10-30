import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import ItemLevelManager from "./ItemLevelManager";

export default async function BlackMarketItemLevelsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await prisma.blackMarketItem.findUnique({
    where: { id },
    include: { levels: { orderBy: { level: "asc" } } },
  });
  if (!item) notFound();

  return (
    <section>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin/black-market/items" className="text-sm text-violet-300 hover:text-violet-200">
            ← All items
          </Link>
          <h1 className="mt-3 text-3xl font-bold">{item.name} levels</h1>
          <p className="mt-2 text-sm text-zinc-400">
            {item.id} · {item.group} · maximum level {item.max_level}
          </p>
        </div>
        <ItemLevelManager
          key={`${item.id}-${item.max_level}-${item.levels.map((level) => level.level).join("-")}`}
          itemId={item.id}
          maxLevel={item.max_level}
          levels={item.levels.map((level) => ({
            level: level.level,
            upgradeCost: level.upgrade_cost,
            imageUrl: level.image_url,
          }))}
        />
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Level</th>
              <th className="px-4 py-3">Upgrade cost</th>
              <th className="px-4 py-3">Image</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {item.levels.map((level) => (
              <tr key={level.id}>
                <td className="px-4 py-3 font-semibold text-white">{level.level}</td>
                <td className="px-4 py-3 text-zinc-300">
                  {level.level === 1 ? "Base level" : level.upgrade_cost?.toLocaleString() ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Image
                    src={level.image_url}
                    alt={`Level ${level.level}`}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 rounded-lg border border-zinc-700 object-cover"
                  />
                </td>
                <td className="px-4 py-3 text-right">
                  <ItemLevelManager
                    itemId={item.id}
                    maxLevel={item.max_level}
                    levels={[]}
                    editLevel={{
                      level: level.level,
                      upgradeCost: level.upgrade_cost,
                      imageUrl: level.image_url,
                    }}
                  />
                </td>
              </tr>
            ))}
            {item.levels.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-12 text-center text-zinc-500">
                  No levels yet. Add level 1 before placing this item in a crate.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
