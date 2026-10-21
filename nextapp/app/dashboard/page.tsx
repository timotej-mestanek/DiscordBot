import { redirect } from "next/navigation";
import Link from "next/link";
import AdminPanel from "@/app/dashboard/AdminPanel";
import AdminShopPanel from "@/app/dashboard/AdminShopPanel";
import DashboardPoints from "@/app/dashboard/DashboardPoints";
import InterestingFactsPanel from "@/app/dashboard/InterestingFactsPanel";
import LEDTimelineEditor from "@/app/dashboard/LEDTimelineEditor";
import WheelAdminPanel from "@/app/dashboard/WheelAdminPanel";
import OverlayBuilder from "@/app/overlays/OverlayBuilder";
import { getCurrentAccount } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { getAccountPointBalances } from "@/lib/points";

const userTabs = [
  { id: "points", label: "Moje body" },
  { id: "leds", label: "LEDS" },
  { id: "auth", label: "Autorizace" },
] as const;

const adminTabs = [
  { id: "interesting", label: "Zaujímavosti" },
  { id: "admin", label: "Admin" },
  { id: "admin-shop", label: "Admin Shop" },
  { id: "wheels", label: "Wheels" },
  { id: "logs", label: "Logs" },
  { id: "overlays", label: "Overlaye" },
] as const;

type DashboardTab =
  | (typeof userTabs)[number]["id"]
  | (typeof adminTabs)[number]["id"];

const dashboardTitles: Record<DashboardTab, string> = {
  points: "Moje body",
  leds: "LEDS",
  auth: "Autorizace",
  interesting: "Zaujímavosti",
  admin: "Administrace",
  "admin-shop": "Admin Shop",
  wheels: "Wheels",
  logs: "Logs",
  overlays: "Overlaye",
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    linked?: string;
    merged?: string;
    error?: string;
  }>;
}) {
  const account = await getCurrentAccount();
  if (!account) redirect("/login");

  const params = await searchParams;
  const activeTab: DashboardTab =
    params.tab === "auth"
      ? "auth"
      : params.tab === "leds"
        ? "leds"
        : account.role === "admin" &&
            adminTabs.some((tab) => tab.id === params.tab)
          ? (params.tab as (typeof adminTabs)[number]["id"])
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
        ? `Účty byly sloučeny a ${params.linked === "discord" ? "Discord" : "Twitch"} účet je teď připojený k tomuto profilu.`
        : `${params.linked === "discord" ? "Discord" : "Twitch"} účet byl úspěšně propojen.`
      : null;
  const [balances, rates] = await Promise.all([
    getAccountPointBalances(account.identities),
    prisma.pointConversionRate.findMany(),
  ]);
  const ledInventory =
    activeTab === "leds"
      ? await prisma.shopInventory.aggregate({
          where: { account_id: account.id },
          _sum: { quantity: true },
        })
      : null;

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-lg font-bold tracking-wide">
            N4JT <span className="font-normal text-zinc-400">Dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={account.role === "admin" ? "/shop?preview=public" : "/shop"}
              className="text-sm font-semibold text-violet-300 hover:text-violet-200"
            >
              Shop
            </Link>
            <span className="hidden text-sm text-zinc-300 sm:inline">
              {account.display_name}
            </span>
            <form action="/api/logout" method="post">
              <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium transition-colors hover:border-zinc-500 hover:bg-zinc-800">
                Odhlásit
              </button>
            </form>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-[220px_1fr] md:py-12">
        <nav aria-label="Dashboard" className="flex gap-2 overflow-x-auto md:flex-col">
          {account.role === "admin" && (
            <div className="flex shrink-0 flex-col gap-1 rounded-xl border border-violet-900/60 bg-violet-950/20 p-2">
              <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-violet-300">
                Admin
              </p>
              {adminTabs.map((tab) => (
                <a
                  key={tab.id}
                  href={`/dashboard?tab=${tab.id}`}
                  aria-current={activeTab === tab.id ? "page" : undefined}
                  className={`rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-violet-600 text-white"
                      : "text-violet-200/80 hover:bg-violet-900/40 hover:text-white"
                  }`}
                >
                  {tab.label}
                </a>
              ))}
              <Link
                href="/dashboard/remote"
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-violet-200/80 transition-colors hover:bg-violet-900/40 hover:text-white"
              >
                Stream Deck
              </Link>
            </div>
          )}
          <div className="flex shrink-0 flex-col gap-1">
            <p className="px-3 py-2 text-xs font-bold uppercase tracking-widest text-zinc-500">
              Můj účet
            </p>
            {userTabs.map((tab) => (
              <a
                key={tab.id}
                href={`/dashboard?tab=${tab.id}`}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`rounded-lg px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white"
                }`}
              >
                {tab.label}
              </a>
            ))}
            <Link
              href={account.role === "admin" ? "/shop?preview=public" : "/shop"}
              className="rounded-lg px-4 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-900 hover:text-white"
            >
              Shop
            </Link>
          </div>
        </nav>

        <section className="min-w-0">
          <div className="mb-7">
            <h1 className="text-3xl font-bold">
              {dashboardTitles[activeTab]}
            </h1>
            <p className="mt-2 text-sm text-zinc-400">
              Přihlášen jako {account.display_name}
            </p>
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
                ? "Tento účet už je propojený s jiným profilem. Účty nebyly sloučeny."
                : params.error === "denied"
                  ? "Autorizace nebyla dokončena."
                  : params.error === "provider"
                    ? "Účet poskytovatele se nepodařilo ověřit."
                        : params.error === "identity-in-use"
                          ? "Účty nelze sloučit: aktuální profil už má připojený jiný účet stejné služby."
                        : "Přihlášení vypršelo. Spusť autorizaci znovu."}
            </p>
          )}

          {activeTab === "points" && (
            <DashboardPoints balances={balances} rates={rates} />
          )}

          {activeTab === "leds" && (
            (ledInventory?._sum.quantity ?? 0) > 0 ? (
              <LEDTimelineEditor initialUses={ledInventory?._sum.quantity ?? 0} />
            ) : (
              <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
                  LEDS · zamčeno
                </p>
                <h2 className="mt-2 text-xl font-semibold">Přístup přes shop</h2>
                <p className="mt-3 text-sm leading-6 text-zinc-400">
                  Pro otevření editoru kup Custom LED effect v shopu. Každé použití v editoru
                  spotřebuje jednu zakoupenou položku.
                </p>
                <Link
                  href="/shop"
                  className="mt-5 inline-flex rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500"
                >
                  Přejít do shopu
                </Link>
              </section>
            )
          )}

          {activeTab === "auth" && (
            <div className="grid gap-4 lg:grid-cols-2">
              {[
                { provider: "discord", label: "Discord", identity: discordIdentity },
                { provider: "twitch", label: "Twitch", identity: twitchIdentity },
              ].map(({ provider, label, identity }) => (
                <article
                  key={provider}
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-semibold">{label}</h2>
                      <p className="mt-2 text-sm text-zinc-400">
                        {identity
                          ? `Propojeno jako ${identity.display_name}`
                          : "K účtu zatím není připojen"}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${
                      identity
                        ? "bg-emerald-950 text-emerald-300"
                        : "bg-zinc-800 text-zinc-400"
                    }`}>
                      {identity ? "Připojeno" : "Nepřipojeno"}
                    </span>
                  </div>
                  {!identity && (
                    <a
                      href={`/api/login/${provider}`}
                      className="mt-5 inline-flex min-h-10 items-center justify-center rounded-lg bg-violet-600 px-4 text-sm font-semibold transition-colors hover:bg-violet-500"
                    >
                      Připojit {label}
                    </a>
                  )}
                </article>
              ))}
              <p className="text-sm leading-6 text-zinc-500 lg:col-span-2">
                Připojení dalších přihlašovacích údajů propojí účty k tomuto profilu. Účet už propojený jinde nelze automaticky sloučit. Webové přihlášení zůstává aktivní 30 dní.
              </p>
            </div>
          )}

          {activeTab === "admin" && account.role === "admin" && (
            <AdminPanel view="settings" />
          )}
          {activeTab === "interesting" && account.role === "admin" && (
            <InterestingFactsPanel />
          )}
          {activeTab === "admin-shop" && account.role === "admin" && (
            <AdminShopPanel />
          )}
          {activeTab === "wheels" && account.role === "admin" && (
            <WheelAdminPanel />
          )}
          {activeTab === "logs" && account.role === "admin" && (
            <AdminPanel view="logs" />
          )}
          {activeTab === "overlays" && account.role === "admin" && (
            <OverlayBuilder />
          )}
        </section>
      </div>
    </main>
  );
}
