"use client";

import { useState } from "react";
import ShopProductCard from "./ShopProductCard";
import type { ShopProduct } from "./ShopProductCard";

type Currency = "discord" | "twitch_custom";
type CatalogLayout = "standard" | "compact" | "black-market";
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
        {layout !== "black-market" && (
          <h1 className="app-page-title text-2xl font-black tracking-tight sm:text-3xl">
            Shop
          </h1>
        )}
        {layout === "black-market" && (
          <h1 className="app-page-title text-2xl font-black tracking-tight sm:text-3xl">
            Blackmarket Shop
          </h1>
        )}
        <section
          aria-label="Choose shop currency"
          className="flex items-center gap-2"
        >
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
                  <span className="flex items-center gap-2">
                    <svg
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                      className="h-5 w-5 shrink-0 fill-current"
                    >
                      {option.id === "discord" ? (
                        <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286ZM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189Zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
                      ) : (
                        <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0 1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" />
                      )}
                    </svg>
                    <span className="sr-only">{option.name}</span>
                  </span>
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
              layout !== "standard"
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
                  compact={layout !== "standard"}
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
