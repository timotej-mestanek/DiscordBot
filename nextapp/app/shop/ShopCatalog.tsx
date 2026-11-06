"use client";

import { useState } from "react";
import ShopProductCard from "./ShopProductCard";
import type { ShopProduct } from "./ShopProductCard";

type Currency = "discord" | "twitch_custom";
type CatalogLayout = "standard" | "black-market";
type Balances = { discord: number | null; twitch: number | null } | null;
type LinkedAccounts = { discord: boolean; twitch: boolean } | null;

export default function ShopCatalog({
  products,
  balances,
  linked,
  quantities,
  isLoggedIn,
  layout = "standard",
}: {
  products: ShopProduct[];
  balances: Balances;
  linked: LinkedAccounts;
  quantities: Record<string, number>;
  isLoggedIn: boolean;
  layout?: CatalogLayout;
}) {
  const [currency, setCurrency] = useState<Currency>("discord");
  const [currentBalances, setCurrentBalances] = useState(balances);
  const [currentQuantities, setCurrentQuantities] = useState(quantities);
  const [notice, setNotice] = useState<{
    message: string;
    isError: boolean;
  } | null>(null);
  function handlePurchase(
    productId: string,
    currency: Currency,
    price: number,
    quantity?: number,
  ) {
    setCurrentBalances((current) => {
      if (!current) return current;
      const key = currency === "discord" ? "discord" : "twitch";
      const balance = current[key];
      return {
        ...current,
        [key]: balance === null ? null : Math.max(0, balance - price),
      };
    });
    if (quantity !== undefined) {
      setCurrentQuantities((current) => ({
        ...current,
        [productId]: quantity,
      }));
    }
  }
  function showNotice(message: string, isError = false) {
    setNotice({ message, isError });
  }
  function handleQuantityChange(productId: string, quantity: number) {
    setCurrentQuantities((current) => ({ ...current, [productId]: quantity }));
  }
  const sections =
    layout === "black-market"
      ? [{ id: "black-market", title: null, products }]
      : [
          {
            id: "black_market_crate",
            title: "Crates",
            products: products.filter(
              (product) => product.productType === "black_market_crate",
            ),
          },
          {
            id: "black_market_key",
            title: "Keys",
            products: products.filter(
              (product) => product.productType === "black_market_key",
            ),
          },
          {
            id: "standard",
            title: null,
            products: products.filter(
              (product) => product.productType === "standard",
            ),
          },
        ].filter((section) => section.products.length > 0);

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {layout === "standard" && (
          <h1 className="app-page-title text-2xl font-black tracking-tight sm:text-3xl">
            Shop
          </h1>
        )}
        <section
          aria-label="Choose shop currency"
          className="flex items-center gap-2"
        >
          <h2 className="text-xs font-semibold text-zinc-400">Pay with</h2>
          <div className="flex rounded-full bg-zinc-900 p-1">
            {([
              {
                id: "discord",
                name: "Discord",
                balance: currentBalances?.discord ?? null,
                connected: linked?.discord ?? false,
                color: "blue",
              },
              {
                id: "twitch_custom",
                name: "Twitch",
                balance: currentBalances?.twitch ?? null,
                connected: linked?.twitch ?? false,
                color: "violet",
              },
            ] as const).map((option) => {
              const active = currency === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setCurrency(option.id)}
                  className={`flex min-h-9 w-36 items-center justify-between gap-2 rounded-full px-3 py-1 text-left transition ${
                    active
                      ? option.color === "blue"
                        ? "bg-blue-500/20 text-blue-100"
                        : "bg-violet-500/20 text-violet-100"
                      : "text-zinc-400 hover:text-white"
                  }`}
                >
                  <span className="text-xs font-semibold">{option.name}</span>
                  <span className="text-[11px] tabular-nums text-zinc-400">
                    {option.connected
                      ? `${option.balance?.toLocaleString("en-US") ?? "—"} pts`
                      : isLoggedIn
                        ? "Link account"
                        : "Sign in"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      </header>

      <div className="space-y-8">
        {sections.map((section) => (
          <section
            key={section.id}
            aria-labelledby={section.title ? `shop-section-${section.id}` : undefined}
            aria-label={section.title ? undefined : "Shop products"}
          >
            {section.title && (
              <h2
                id={`shop-section-${section.id}`}
                className="mb-3 text-xl font-black tracking-tight text-white"
              >
                {section.title}
              </h2>
            )}
            <div className={`grid ${
              layout === "black-market"
                ? "grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                : "gap-x-5 gap-y-6 sm:grid-cols-2 lg:grid-cols-3"
            }`}>
              {section.products.map((product) => (
                <ShopProductCard
                  key={product.id}
                  product={product}
                  currency={currency}
                  balances={currentBalances}
                  linked={linked}
                  quantity={currentQuantities[product.id] ?? 0}
                  isLoggedIn={isLoggedIn}
                  compact={layout === "black-market"}
                  onPurchase={(currency, price, quantity) =>
                    handlePurchase(product.id, currency, price, quantity)
                  }
                  onQuantityChange={(quantity) =>
                    handleQuantityChange(product.id, quantity)
                  }
                  onNotice={showNotice}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
      {notice && (
        <div
          role={notice.isError ? "alert" : "status"}
          className="fixed inset-x-0 bottom-0 z-50 px-3 pb-3 sm:px-6 sm:pb-5"
        >
          <div
            className={`mx-auto flex max-w-5xl items-center justify-between gap-4 rounded-t-2xl px-5 py-4 shadow-[0_-12px_40px_rgb(0_0_0/0.4)] sm:rounded-2xl sm:px-8 sm:py-5 ${
              notice.isError
                ? "bg-red-500 text-red-950"
                : "bg-emerald-500 text-emerald-950"
            }`}
          >
            <p className="text-base font-bold sm:text-xl">{notice.message}</p>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="Dismiss purchase confirmation"
              className="shrink-0 rounded-full bg-emerald-950/10 px-3 py-1 text-sm font-bold hover:bg-emerald-950/20"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
