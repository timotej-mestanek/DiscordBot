import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentAdmin } from "@/lib/auth/admin";

const links = [
  { href: "/admin/black-market", label: "Overview" },
  { href: "/admin/black-market/crates", label: "Crates" },
  { href: "/admin/black-market/items", label: "Items" },
];

export default async function BlackMarketAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!(await getCurrentAdmin())) redirect("/dashboard");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/dashboard" className="text-lg font-bold tracking-wide">
            N4JT <span className="font-normal text-zinc-400">Admin</span>
          </Link>
          <Link
            href="/black-market"
            className="text-sm font-semibold text-amber-200 hover:text-amber-100"
          >
            View Black Market
          </Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        <nav aria-label="Black Market administration" className="mb-8 flex flex-wrap gap-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-violet-900/60 bg-violet-950/20 px-4 py-2 text-sm font-medium text-violet-200 hover:bg-violet-900/40"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        {children}
      </div>
    </main>
  );
}
