import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function BlackMarketAdminPage() {
  const [crateStats, itemCount] = await Promise.all([
    prisma.blackMarketCrate.aggregate({ _count: true, _sum: { open_count: true } }),
    prisma.blackMarketItem.count(),
  ]);
  const totalOpens = crateStats._sum.open_count ?? 0;
  const cards = [
    {
      title: "Crates",
      count: crateStats._count,
      description: "Create crates and manage their drop tables.",
      href: "/admin/black-market/crates",
    },
    {
      title: "Items",
      count: itemCount,
      description: "Manage items and their upgrade levels.",
      href: "/admin/black-market/items",
    },
    {
      title: "Total opens",
      count: totalOpens,
      description: "Successful crate opens since this counter was added.",
      href: null,
    },
  ];

  return (
    <section>
      <div className="mb-7">
        <h1 className="text-3xl font-bold">Black Market administration</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Manage crate content, item levels, and published images.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const content = (
            <>
              <p className="text-sm font-semibold text-violet-200">{card.title}</p>
              <p className="mt-3 text-3xl font-bold">{card.count ?? "—"}</p>
              <p className="mt-2 text-sm text-zinc-400">{card.description}</p>
            </>
          );
          return card.href ? (
            <Link
              key={card.title}
              href={card.href}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 transition-colors hover:border-violet-700"
            >
              {content}
            </Link>
          ) : (
            <div
              key={card.title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/70 p-5"
            >
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
