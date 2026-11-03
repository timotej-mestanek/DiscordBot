import { redirect } from "next/navigation";
import Link from "next/link";
import AppHeader from "@/app/AppHeader";
import AdminPanel from "@/app/dashboard/AdminPanel";
import AdminShopPanel from "@/app/dashboard/AdminShopPanel";
import DashboardPoints from "@/app/dashboard/DashboardPoints";
import InterestingFactsPanel from "@/app/dashboard/InterestingFactsPanel";
import InventoryPanel from "@/app/dashboard/InventoryPanel";
import LEDTimelineEditor from "@/app/dashboard/LEDTimelineEditor";
import WheelAdminPanel from "@/app/dashboard/WheelAdminPanel";
import OverlayBuilder from "@/app/overlays/OverlayBuilder";
import UsersPanel from "@/app/dashboard/UsersPanel";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAccountPointBalances } from "@/lib/points";

const userTabs = [
  { id: "points", label: "My points" },
  { id: "inventory", label: "Inventory" },
  { id: "leds", label: "LEDS" },
  { id: "auth", label: "Authorization" },
] as const;

const adminTabs = [
  { id: "admin", label: "Stream Settings" },
  { id: "admin-shop", label: "Shop" },
  { id: "wheels", label: "Wheels" },
  { id: "overlays", label: "Overlays" },
  { id: "interesting", label: "Fun facts" },
  { id: "users", label: "Users" },
  { id: "logs", label: "Logs" },
] as const;

type DashboardTab =
  | (typeof userTabs)[number]["id"]
  | (typeof adminTabs)[number]["id"];

const dashboardTitles: Record<DashboardTab, string> = {
  points: "My points",
  inventory: "Inventory",
  leds: "LEDS",
  auth: "Authorization",
  interesting: "Fun facts",
  users: "Users",
  admin: "Stream Settings",
  "admin-shop": "Shop",
  wheels: "Wheels",
  logs: "Logs",
  overlays: "Overlays",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string;
    tab?: string;
    linked?: string;
    merged?: string;
    error?: string;
  }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const params = await searchParams;
  const adminView =
    account.role === "admin" &&
    params.view !== "user" &&
    (params.view === "admin" ||
      adminTabs.some((tab) => tab.id === params.tab));
  const activeTab: DashboardTab = adminView
    ? adminTabs.some((tab) => tab.id === params.tab)
      ? (params.tab as (typeof adminTabs)[number]["id"])
      : "admin"
    : userTabs.some((tab) => tab.id === params.tab)
      ? (params.tab as (typeof userTabs)[number]["id"])
      : "points";
  const discordIdentity = account.identities.find(
    (identity) => identity.provider === "discord",
  );
  const twitchIdentity = account.identities.find(
    (identity) => identity.provider === "twitch",
  );
  const linkedLabel =
    params.linked === "discord" || params.linked === "twitch"
      ? params.merged === "true"
        ? `Accounts were merged and the ${params.linked === "discord" ? "Discord" : "Twitch"} account is now linked to this profile.`
        : `${params.linked === "discord" ? "Discord" : "Twitch"} account linked successfully.`
      : null;
  const [balances, rates] = await Promise.all([
    getAccountPointBalances(account.identities),
    prisma.pointConversionRate.findMany(),
  ]);
  const ledInventory =
    activeTab === "leds"
      ? await prisma.shopInventory.aggregate({
          where: { account_id: account.id, product_id: "custom-led-effect" },
          _sum: { quantity: true },
        })
      : null;
  const inventory =
    activeTab === "inventory"
      ? await prisma.shopInventory.findMany({
          where: { account_id: account.id, quantity: { gt: 0 } },
          orderBy: { product: { name: "asc" } },
          select: {
            product_id: true,
            quantity: true,
            product: { select: { name: true, description: true } },
          },
        })
      : [];

  return (
    <main className="app-page min-h-screen bg-zinc-950 text-white">
      <AppHeader
        account={account}
        balances={balances}
        adminView={adminView}
        activeTab={activeTab}
      />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 md:py-8">
        <section className="min-w-0">
          <div className="mb-4">
            <h1 className="app-page-title text-2xl font-bold">
              {dashboardTitles[activeTab]}
            </h1>
          </div>

          {linkedLabel && (
            <p className="mb-5 rounded-lg border border-emerald-900 bg-emerald-950/50 p-3 text-sm text-emerald-200">
              {linkedLabel}
            </p>
          )}
          {params.error && (
            <p
              role="alert"
              className="mb-5 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200"
            >
              {params.error === "identity-in-use"
                ? "This account is already linked to another profile. The accounts were not merged."
                : params.error === "denied"
                  ? "Authorization was not completed."
                  : params.error === "provider"
                    ? "The provider account could not be verified."
                    : "Your sign-in session expired. Start authorization again."}
            </p>
          )}

          {activeTab === "points" && (
            <DashboardPoints balances={balances} rates={rates} />
          )}

          {activeTab === "inventory" && (
            <InventoryPanel initialItems={inventory} />
          )}

          {activeTab === "leds" && (
            (ledInventory?._sum.quantity ?? 0) > 0 ? (
              <LEDTimelineEditor initialUses={ledInventory?._sum.quantity ?? 0} />
            ) : (
              <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
                  LEDS · locked
                </p>
                <h2 className="mt-1.5 text-lg font-semibold">Unlock through the shop</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Buy Custom LED effect in the shop to unlock the editor. Each use
                  consumes one purchased item.
                </p>
                <Link
                  href="/shop"
                  className="mt-3 inline-flex rounded-md bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500"
                >
                  Go to shop
                </Link>
              </section>
            )
          )}

          {activeTab === "auth" && (
            <div className="grid gap-3 lg:grid-cols-2">
              {[
                { provider: "discord", label: "Discord", identity: discordIdentity },
                { provider: "twitch", label: "Twitch", identity: twitchIdentity },
              ].map(({ provider, label, identity }) => (
                <article
                  key={provider}
                  className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{label}</h2>
                      <p className="mt-1 text-sm text-zinc-400">
                        {identity
                          ? `Linked as ${identity.display_name}`
                          : "Not linked to this account yet"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${
                      identity
                        ? "bg-emerald-950 text-emerald-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {identity ? "Connected" : "Not connected"}
                    </span>
                  </div>
                  {!identity && (
                    <a
                      href={`/api/login/${provider}`}
                      className="mt-3 inline-flex min-h-9 items-center justify-center rounded-md bg-violet-600 px-3 text-sm font-semibold transition-colors hover:bg-violet-500"
                    >
                      Connect {label}
                    </a>
                  )}
                </article>
              ))}
              <p className="text-sm leading-6 text-zinc-500 lg:col-span-2">
                Linking another sign-in connects that account to this profile. An account already linked elsewhere cannot be merged automatically. Web sign-in remains active for 30 days.
              </p>
            </div>
          )}

          {adminView && activeTab === "admin" && (
            <AdminPanel view="settings" />
          )}
          {adminView && activeTab === "interesting" && (
            <InterestingFactsPanel />
          )}
          {adminView && activeTab === "users" && (
            <UsersPanel />
          )}
          {adminView && activeTab === "admin-shop" && (
            <AdminShopPanel />
          )}
          {adminView && activeTab === "wheels" && (
            <WheelAdminPanel />
          )}
          {adminView && activeTab === "logs" && (
            <AdminPanel view="logs" />
          )}
          {adminView && activeTab === "overlays" && (
            <OverlayBuilder />
          )}
        </section>
      </div>
    </main>
  );
}
