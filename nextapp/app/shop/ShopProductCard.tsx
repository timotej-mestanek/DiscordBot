"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";

type Currency = "discord" | "twitch_custom";
type Product = {
  id: string;
  name: string;
  description: string;
  cardColor: string;
  imageUrl: string | null;
  discordPrice: number | null;
  twitchPrice: number | null;
  active: boolean;
  productType: "standard" | "black_market_crate" | "black_market_key";
  blackMarketCrate: { id: string; name: string } | null;
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
  const [busy, setBusy] = useState<Currency | "redeem" | null>(null);

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
      const result: {
        error?: string;
        addToInventory?: boolean;
        deliveryEventId?: string | null;
        blackMarketType?: "black_market_crate" | "black_market_key" | null;
      } = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "The purchase could not be completed.");
        return;
      }
      if (result.blackMarketType) {
        setSuccess(true);
        setMessage(
          result.blackMarketType === "black_market_crate"
            ? "Crate added to your Black Market."
            : "Key added to your Black Market.",
        );
        window.setTimeout(() => window.location.reload(), 900);
        return;
      }
      if (!result.addToInventory) {
        setSuccess(true);
        setMessage(
          result.deliveryEventId
            ? "Purchased and queued for Streamer.bot."
            : "Purchased. The item was not configured for Streamer.bot delivery.",
        );
        window.setTimeout(() => window.location.reload(), 900);
        return;
      }
      window.location.reload();
    } catch (error) {
      console.error("Shop purchase request failed:", error);
      setMessage("The purchase could not be completed.");
    } finally {
      setBusy(null);
    }
  }

  async function redeem() {
    setBusy("redeem");
    setMessage("");
    setSuccess(false);
    try {
      const response = await fetch("/api/shop/redeem-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const result: { error?: string; deliveryEventId?: string } = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "The item could not be redeemed.");
        return;
      }
      setSuccess(true);
      setMessage("Redeemed and queued for Streamer.bot.");
      window.setTimeout(() => window.location.reload(), 900);
    } catch (error) {
      console.error("Shop item redemption request failed:", error);
      setMessage("The item could not be redeemed.");
    } finally {
      setBusy(null);
    }
  }

  const prices = [
    {
      currency: "discord" as const,
      label: "Discord",
      price: product.discordPrice,
      balance: balances?.discord ?? null,
      connected: linked?.discord ?? false,
    },
    {
      currency: "twitch_custom" as const,
      label: "Twitch",
      price: product.twitchPrice,
      balance: balances?.twitch ?? null,
      connected: linked?.twitch ?? false,
    },
  ];

  return (
    <article
      className="flex h-full flex-col overflow-hidden rounded-xl border bg-zinc-950/90 shadow-lg shadow-black/20"
      style={{
        borderColor: `${product.cardColor}88`,
        background: `linear-gradient(150deg, ${product.cardColor}25 0%, rgba(24, 24, 27, 0.96) 35%, rgb(9, 9, 11) 100%)`,
      }}
    >
      <div className="relative flex min-h-20 items-center justify-between gap-3 overflow-hidden border-b border-white/10 px-4 py-3">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-8 -top-14 h-36 w-36 rounded-full blur-3xl"
          style={{ backgroundColor: `${product.cardColor}35` }}
        />
        <div className="relative z-10 min-w-0">
          <h2 className="break-words text-lg font-bold tracking-tight text-white">
            {product.name}
          </h2>
          {product.productType !== "standard" && (
            <p className="mt-0.5 text-xs text-violet-200">
              {product.productType === "black_market_crate"
                ? "Black Market crate"
                : `Key · ${product.blackMarketCrate?.name ?? "crate"}`}
            </p>
          )}
        </div>
        <div
          aria-hidden={product.imageUrl ? undefined : true}
          className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-black/20 shadow-lg backdrop-blur-sm"
          style={{ borderColor: `${product.cardColor}70`, color: product.cardColor }}
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={`${product.name} icon`}
              fill
              unoptimized
              sizes="48px"
              className="object-cover"
            />
          ) : (
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="h-7 w-7"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 20h34v22H7zM4 13h40v7H4zM24 13v29" />
              <path d="M24 13H14a5 5 0 1 1 5-5c0 3 5 5 5 5Zm0 0h10a5 5 0 1 0-5-5c0 3-5 5-5 5Z" />
            </svg>
          )}
        </div>
        {quantity > 0 && (
          <span className="absolute bottom-2 left-4 z-10 rounded-full border border-emerald-900 bg-emerald-950/80 px-2 py-0.5 text-[11px] font-semibold text-emerald-200">
            Owned ×{quantity}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p
          className="line-clamp-2 min-h-10 overflow-hidden text-sm leading-5 text-zinc-300"
          title={product.description}
        >
          {product.description}
        </p>

        {!product.active ? (
          <p className="mt-3 rounded-lg border border-zinc-800 bg-zinc-950/60 p-2 text-sm text-zinc-400">
            This product is not currently for sale.
          </p>
        ) : (
          <div className="mt-3 grid flex-1 gap-2 sm:grid-cols-2">
            {prices.map(({ currency, label, price, balance, connected }) => (
              <div key={currency} className="flex flex-col rounded-lg border border-white/10 bg-black/25 p-3">
                <p className="text-xs font-semibold text-zinc-300">{label}</p>
                <p className="mt-0.5 text-sm font-semibold text-white">
                  {price?.toLocaleString("en-US") ?? "—"} <span className="text-xs font-normal text-zinc-400">pts</span>
                </p>
                {connected && balance !== null && (
                  <p className="mt-0.5 text-[11px] text-zinc-500">
                    Balance {balance.toLocaleString("en-US")}
                  </p>
                )}
                <div className="mt-auto pt-2">
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
                        className="w-full rounded-md px-2 py-1.5 text-xs font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
                        style={{
                          backgroundColor: product.cardColor,
                          color: "white",
                        }}
                      >
                        {busy === currency
                          ? "Purchasing…"
                          : balance !== null && price !== null && balance < price
                            ? "Not enough points"
                            : product.addToInventory
                              ? "Buy"
                              : "Buy and use"}
                      </button>
                    ) : (
                      <Link
                        href="/dashboard?tab=auth"
                        className="block rounded-md border border-zinc-700 px-2 py-1.5 text-center text-xs font-semibold hover:bg-zinc-800"
                      >
                        Link account
                      </Link>
                    )
                  ) : (
                    <Link
                      href="/login"
                      className="block rounded-md px-2 py-1.5 text-center text-xs font-semibold text-white hover:brightness-110"
                      style={{ backgroundColor: product.cardColor }}
                    >
                      Sign in
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {quantity > 0 && product.id !== "custom-led-effect" && isLoggedIn && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void redeem()}
            className="mt-3 w-full rounded-md border border-emerald-800 bg-emerald-950/40 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/50 disabled:opacity-50"
          >
            {busy === "redeem" ? "Redeeming…" : "Redeem from inventory"}
          </button>
        )}
        {message && (
          <p
            role={success ? "status" : "alert"}
            className={`mt-3 rounded-lg border p-2 text-xs ${
              success
                ? "border-emerald-900 bg-emerald-950/50 text-emerald-200"
                : "border-red-900 bg-red-950/50 text-red-200"
            }`}
          >
            {message}
          </p>
        )}
      </div>
    </article>
  );
}
