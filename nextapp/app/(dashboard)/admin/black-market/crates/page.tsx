import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import CrateManager from "./CrateManager";

export default async function BlackMarketCratesPage() {
  const crates = await prisma.blackMarketCrate.findMany({
    orderBy: [{ created_at: "desc" }, { name: "asc" }],
    include: { _count: { select: { inventories: true, items: true } } },
  });

  return (
    <section>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Black Market crates</h1>
          <p className="mt-2 text-sm text-zinc-400">Create crates and choose what can drop.</p>
        </div>
        <CrateManager />
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-900/60">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="border-b border-zinc-800 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">Preview</th>
              <th className="px-4 py-3">ID / name</th>
              <th className="px-4 py-3">Active</th>
              <th className="px-4 py-3">Model</th>
              <th className="px-4 py-3">Starts / ends</th>
              <th className="px-4 py-3">Items</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {crates.map((crate) => (
              <tr key={crate.id}>
                <td className="px-4 py-3">
                  {crate.preview_image_url ? (
                    <Image
                      src={crate.preview_image_url}
                      alt=""
                      width={64}
                      height={48}
                      unoptimized
                      className="h-12 w-16 rounded-md object-cover"
                    />
                  ) : <span className="text-zinc-600">—</span>}
                </td>
                <td className="px-4 py-3">
                  <p className="font-semibold text-white">{crate.name}</p>
                  <p className="mt-1 text-xs text-zinc-500">{crate.id}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={crate.active ? "text-emerald-300" : "text-zinc-500"}>
                    {crate.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                    crate.texture_url
                      ? "border-violet-800 bg-violet-950/50 text-violet-200"
                      : "border-zinc-700 bg-zinc-950 text-zinc-400"
                  }`}>
                    {crate.texture_url ? "3D" : "2D only"}
                  </span>
                </td>
                <td className="px-4 py-3 text-zinc-300">
                  <div>{crate.starts_at?.toLocaleString() ?? "Anytime"}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    to {crate.ends_at?.toLocaleString() ?? "No end"}
                  </div>
                </td>
                <td className="px-4 py-3 text-zinc-300">{crate._count.items}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Link
                      href={`/admin/black-market/crates/${encodeURIComponent(crate.id)}`}
                      className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium text-zinc-200 hover:border-violet-600"
                    >
                      Manage Items
                    </Link>
                    <CrateManager
                      editCrate={{
                        id: crate.id,
                        name: crate.name,
                        active: crate.active,
                        startsAt: crate.starts_at?.toISOString() ?? null,
                        endsAt: crate.ends_at?.toISOString() ?? null,
                        previewImageUrl: crate.preview_image_url,
                        textureUrl: crate.texture_url,
                        inventoryCount: crate._count.inventories,
                        itemCount: crate._count.items,
                      }}
                    />
                  </div>
                </td>
              </tr>
            ))}
            {crates.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-500">
                  No crates yet. Create the first one to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
