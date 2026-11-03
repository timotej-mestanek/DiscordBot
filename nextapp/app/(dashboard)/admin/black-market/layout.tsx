import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { getCurrentAdmin } from "@/lib/auth/admin";
import AppHeader from "@/app/AppHeader";

export default async function BlackMarketAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const account = await getCurrentAdmin();
  if (!account) redirect("/dashboard");

  return (
    <main className="app-page min-h-screen bg-zinc-950 text-white">
      <AppHeader
        account={account}
        section="shop"
        shopTab="blackmarket"
        adminView
        adminTab="blackmarket"
      />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-12">
        {children}
      </div>
    </main>
  );
}
