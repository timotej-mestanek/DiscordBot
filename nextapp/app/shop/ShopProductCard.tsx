"use client";

import Link from "next/link";
import { useState } from "react";

type Currency = "discord" | "twitch_custom";
type Product = {
  id: string;
  name: string;
  description: string;
  discordPrice: number | null;
  twitchPrice: number | null;
  active: boolean;
  addToInventory: boolean;
};

export default function ShopProductCard({
  product,
  balances,
  linked,
  quantity,
  isLoggedIn,
}: {
  product: Product;
  balances: { discord: number | null; twitch: number | null } | null;
  linked: { discord: boolean; twitch: boolean } | null;
  quantity: number;
  isLoggedIn: boolean;
}) {
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState<Currency | null>(null);

  async function purchase(currency: Currency) {
    setBusy(currency);
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/shop/purchase", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currency, productId: product.id }),
      });
      const result: { error?: string; addToInventory?: boolean } = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "Nákup se nepodařilo dokončit.");
        return;
      }
      if (!result.addToInventory) {
        setSuccess(true);
        setMessage("Položka byla zaplacena a okamžitě použita.");
        window.setTimeout(() => window.location.reload(), 900);
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error("Shop purchase request failed:", error);
      setMessage("Nákup se nepodařilo dokončit.");
    } finally {
      setBusy(null);
    }
  }

  const prices = [
    {
      currency: "discord" as const,
      label: "Discord body",
      price: product.discordPrice,
      balance: balances?.discord ?? null,
      connected: linked?.discord ?? false,
    },
    {
      currency: "twitch_custom" as const,
      label: "Twitch CustomBody",
      price: product.twitchPrice,
      balance: balances?.twitch ?? null,
      connected: linked?.twitch ?? false,
    },
  ];

  return (
    <article className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
            {product.addToInventory ? "Položka · do inventáře" : "Položka · okamžité použití"}
          </p>
          <h2 className="mt-2 text-2xl font-bold">{product.name}</h2>
        </div>
        {quantity > 0 && (
          <span className="rounded-full border border-emerald-900 bg-emerald-950/50 px-3 py-1 text-sm font-semibold text-emerald-200">
            V inventáři: {quantity}
          </span>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-zinc-400">{product.description}</p>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        {product.addToInventory
          ? "Po nákupu se položka přidá do inventáře a můžeš ji použít později."
          : "Po nákupu se položka okamžitě použije a nepřidá se do inventáře."}
      </p>

      {!product.active ? (
        <p className="mt-5 rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 text-sm text-zinc-400">
          Produkt teď není v prodeji.
        </p>
      ) : (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {prices.map(({ currency, label, price, balance, connected }) => (
            <div key={currency} className="rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
              <p className="font-semibold">{label}</p>
              <p className="mt-1 text-sm text-zinc-400">
                {price?.toLocaleString("cs-CZ") ?? "—"} bodů
              </p>
              {connected && balance !== null && (
                <p className="mt-1 text-xs text-zinc-500">
                  Zůstatek: {balance.toLocaleString("cs-CZ")}
                </p>
              )}
              {isLoggedIn ? (
                connected ? (
                  <button
                    type="button"
                    disabled={
                      price === null ||
                      busy !== null ||
                      balance === null ||
                      balance < price
                    }
                    onClick={() => void purchase(currency)}
                    className="mt-4 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                  >
                    {busy === currency
                      ? "Nakupuji…"
                      : balance !== null && price !== null && balance < price
                        ? "Nedostatek bodů"
                        : product.addToInventory
                          ? "Koupit"
                          : "Koupit a použít"}
                  </button>
                ) : (
                  <Link
                    href="/dashboard?tab=auth"
                    className="mt-4 block rounded-lg border border-zinc-700 px-3 py-2 text-center text-sm font-semibold hover:bg-zinc-800"
                  >
                    Propojit účet
                  </Link>
                )
              ) : (
                <Link
                  href="/login"
                  className="mt-4 block rounded-lg bg-violet-600 px-3 py-2 text-center text-sm font-semibold hover:bg-violet-500"
                >
                  Přihlásit se
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
      {isLoggedIn && linked && (!linked.discord || !linked.twitch) && (
        <p className="mt-4 text-xs text-zinc-500">
          Pro nákup danou měnou připoj příslušný účet v dashboardu → Autorizace.
        </p>
      )}
      {message && (
        <p
          role={success ? "status" : "alert"}
          className={`mt-4 rounded-lg border p-3 text-sm ${
            success
              ? "border-emerald-900 bg-emerald-950/50 text-emerald-200"
              : "border-red-900 bg-red-950/50 text-red-200"
          }`}
        >
          {message}
        </p>
      )}
    </article>
  );
}
