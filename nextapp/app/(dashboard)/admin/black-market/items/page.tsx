import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import ItemManager from "./ItemManager";

export default async function BlackMarketItemsPage() {
  const items = await prisma.blackMarketItem.findMany({
    orderBy: [{ group: "asc" }, { name: "asc" }],
    include: {
      levels: { where: { level: 1 }, select: { image_url: true } },
      _count: { select: { owned_by: true, levels: true } },
    },
  });

  return (
    <section>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Black Market items</h1>
          <p className="mt-2 text-sm text-zinc-400">Create collectible items and configure upgrade levels.</p>
        </div>
        <ItemManager />
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Thumbnail</th>
              <th className="px-4 py-3">ID / name</th>
              <th className="px-4 py-3">Group</th>
              <th className="px-4 py-3">Max level</th>
              <th className="px-4 py-3">Owned</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3">
                  {item.levels[0] ? (
                    <Image
                      src={item.levels[0].image_url}
                      alt=""
                      width={48}
                      height={48}
                      unoptimized
                      className="h-12 w-12 rounded-md object-cover"
                    />
                  ) : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{item.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{item.id}</p>
                </td>
                <td className="px-4 py-3 text-zinc-300">{item.group}</td>
                <td className="px-4 py-3 text-zinc-300">{item.max_level}</td>
                <td className="px-4 py-3 text-zinc-300">{item._count.owned_by}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/black-market/items/${encodeURIComponent(item.id)}`}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-violet-600"
                    >
                      Manage Levels ({item._count.levels})
                    </Link>
                    <ItemManager
                      item={{
                        id: item.id,
                        name: item.name,
                        group: item.group,
                        maxLevel: item.max_level,
                        ownedCount: item._count.owned_by,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-500">
                  No items yet. Create the first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
