"use client";

import Link from "next/link";
import { useState } from "react";
import ShopProductArtwork from "./ShopProductArtwork";

type Currency = "discord" | "twitch_custom";
export type ShopProduct = {
  id: string;
  name: string;
  description: string;
  cardColor: string;
  imageUrl: string | null;
  discordPrice: number | null;
  twitchPrice: number | null;
  active: boolean;
  productType:
    | "standard"
    | "black_market_crate"
    | "black_market_key"
    | "black_market_item";
  blackMarketCrate: { id: string; name: string } | null;
  addToInventory: boolean;
  blackMarketItemExpiry?: "permanent" | "seven_days" | "thirty_days" | "event_end" | null;
};

export default function ShopProductCard({
  product,
  currency,
  balances,
  linked,
  quantity,
  isLoggedIn,
  compact = false,
  onPurchase,
  onQuantityChange,
  onNotice,
}: {
  product: ShopProduct;
  currency: Currency;
  balances: { discord: number | null; twitch: number | null } | null;
  linked: { discord: boolean; twitch: boolean } | null;
  quantity: number;
  isLoggedIn: boolean;
  compact?: boolean;
  onPurchase: (
    currency: Currency,
    price: number,
    quantity?: number,
  ) => void;
  onQuantityChange: (quantity: number) => void;
  onNotice: (message: string, isError?: boolean) => void;
}) {
  const [busy, setBusy] = useState<Currency | "redeem" | null>(null);
  const [showCrateInfo, setShowCrateInfo] = useState(false);

  async function purchase(currency: Currency) {
    setBusy(currency);
    try {
      const isBlackMarketItem = product.productType === "black_market_item";
      const response = await fetch(
        isBlackMarketItem ? "/api/black-market/purchase-item" : "/api/shop/purchase",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isBlackMarketItem
              ? { currency, itemId: product.id }
              : { currency, productId: product.id },
          ),
        },
      );
      const result: {
        error?: string;
        addToInventory?: boolean;
        quantity?: number;
        deliveryEventId?: string | null;
        blackMarketType?: "black_market_crate" | "black_market_key" | null;
        blackMarketQuantity?: number;
        autoEquipped?: boolean;
      } = await response.json();
      if (!response.ok) {
        onNotice(result.error ?? "The purchase could not be completed.", true);
        return;
      }
      const purchasedQuantity = result.blackMarketType
        ? result.blackMarketQuantity
        : result.addToInventory
          ? result.quantity
          : undefined;
      onPurchase(currency, price ?? 0, purchasedQuantity);
      if (isBlackMarketItem) {
        onNotice(
          result.autoEquipped
            ? "Seasonal item purchased and activated."
            : "Item added to your Black Market inventory. Activate it when you're ready.",
        );
        return;
      }
      if (result.blackMarketType) {
        onNotice(
          result.blackMarketType === "black_market_crate"
            ? "Crate added to your Black Market."
            : "Key added to your Black Market.",
        );
        return;
      }
      if (!result.addToInventory) {
        onNotice(
          result.deliveryEventId
            ? "Purchased and queued for Streamer.bot."
            : "Purchased. The item was not configured for Streamer.bot delivery.",
        );
        return;
      }
      onNotice("Purchased and added to your inventory.");
    } catch (error) {
      console.error("Shop purchase request failed:", error);
      onNotice("The purchase could not be completed.", true);
    } finally {
      setBusy(null);
    }
  }

  async function redeem() {
    setBusy("redeem");
    try {
      const response = await fetch("/api/shop/redeem-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId: product.id }),
      });
      const result: { error?: string; deliveryEventId?: string; quantity?: number } =
        await response.json();
      if (!response.ok) {
        onNotice(result.error ?? "The item could not be redeemed.", true);
        return;
      }
      if (
        typeof result.quantity !== "number" ||
        !Number.isSafeInteger(result.quantity) ||
        result.quantity < 0
      ) {
        onNotice(
          "The item was redeemed, but the updated inventory count is unavailable.",
          true,
        );
        return;
      }
      onQuantityChange(result.quantity);
      onNotice("Redeemed and queued for Streamer.bot.");
    } catch (error) {
      console.error("Shop item redemption request failed:", error);
      onNotice("The item could not be redeemed.", true);
    } finally {
      setBusy(null);
    }
  }

  const price = currency === "discord" ? product.discordPrice : product.twitchPrice;
  const balance =
    currency === "discord" ? balances?.discord ?? null : balances?.twitch ?? null;
  const connected =
    currency === "discord" ? linked?.discord ?? false : linked?.twitch ?? false;
  const currencyLabel =
    currency === "discord" ? "Discord points" : "Twitch CustomBody";
  const productKind =
    product.productType === "black_market_crate"
      ? "Crate"
      : product.productType === "black_market_key"
        ? "Key"
        : "Shop item";

  return (
    <article
      id={product.id === "custom-led-effect" ? "custom-led-effect" : undefined}
      className="flex h-full flex-col"
    >
      <div
        className={`relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden ${
          product.productType === "black_market_key"
            ? "text-amber-300"
            : product.productType === "black_market_crate"
              ? "text-orange-200"
              : "text-violet-300"
        }`}
        style={{
          background:
            product.productType === "black_market_key"
              ? "radial-gradient(ellipse at center, rgb(245 158 11 / 12%), transparent 68%)"
              : product.productType === "black_market_crate"
                ? "radial-gradient(ellipse at center, rgb(249 115 22 / 12%), transparent 68%)"
                : `radial-gradient(ellipse at center, ${product.cardColor}20, transparent 68%)`,
        }}
      >
        <ShopProductArtwork product={product} />
        {product.productType === "black_market_crate" && (
          <>
            <button
              type="button"
              title={product.description || "Black Market crate"}
              aria-label={`More information about ${product.name}`}
              aria-expanded={showCrateInfo}
              onClick={() => setShowCrateInfo((current) => !current)}
              className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full border border-white/30 bg-black/70 text-xs font-bold text-white"
            >
              ?
            </button>
            {showCrateInfo && (
              <p className="absolute right-2 top-10 z-10 max-w-[90%] rounded-lg border border-zinc-700 bg-zinc-950/95 p-2 text-left text-xs leading-4 text-zinc-200 shadow-xl">
                {product.description || "No additional crate information."}
              </p>
            )}
          </>
        )}
      </div>
      <div className={`flex flex-1 flex-col px-2 text-center ${compact ? "pb-2 pt-1" : "pb-3 pt-1"}`}>
        {!compact && (
          <p
            className={`text-[10px] font-bold uppercase tracking-[0.2em] ${
              product.productType === "black_market_key"
                ? "text-amber-300"
                : product.productType === "black_market_crate"
                  ? "text-orange-200"
                  : "text-violet-300"
            }`}
          >
            {productKind}
            {product.blackMarketCrate && product.productType === "black_market_key"
              ? ` for ${product.blackMarketCrate.name}`
              : ""}
          </p>
        )}
        <h2 className={`break-words font-bold text-white ${
          compact ? "text-sm sm:text-base" : "mt-1 text-lg sm:text-xl"
        }`}>
          {product.name}
        </h2>
        {compact && product.blackMarketItemExpiry &&
          product.blackMarketItemExpiry !== "permanent" && (
            <p className="mt-1 text-[10px] text-amber-200">
              {product.blackMarketItemExpiry === "event_end"
                ? "Use until season ends"
                : `Expires after ${product.blackMarketItemExpiry === "seven_days" ? "7 days" : "30 days"}`}
            </p>
          )}
        {(!compact ||
          (product.description &&
            product.productType !== "black_market_crate")) && (
          <p
            className={`mx-auto max-w-sm text-zinc-400 ${
              compact
                ? "mt-1 line-clamp-2 text-xs leading-4"
                : "mt-2 line-clamp-3 text-sm leading-6"
            }`}
            title={product.description}
          >
            {product.description}
          </p>
        )}
        <div className={`${compact ? "mt-1 h-5" : "mt-2 h-6"} flex items-center justify-center`}>
          {isLoggedIn &&
            product.productType === "standard" &&
            product.id !== "custom-led-effect" && (
              <button
                type="button"
                disabled={busy !== null || quantity === 0}
                onClick={() => void redeem()}
                className={`whitespace-nowrap text-center font-semibold text-emerald-300 hover:text-emerald-200 disabled:opacity-50 ${
                  compact ? "text-[10px]" : "min-w-44 text-xs"
                } ${
                  quantity === 0 ? "invisible" : ""
                }`}
              >
                {busy === "redeem" ? "Redeeming…" : "Redeem from inventory"}
              </button>
            )}
        </div>
      </div>

      <div className={`mt-auto flex flex-col items-center px-2 ${
        compact ? "gap-1 pb-2 pt-1" : "gap-3 pb-5 pt-4"
      }`}>
        {!product.active ? (
          <p className="text-xs text-zinc-500">
            This product is not currently for sale.
          </p>
        ) : (
          <div className={`flex w-full flex-col items-center ${compact ? "gap-1" : "gap-3"}`}>
            {!compact && (
              <div className="w-full text-center">
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">
                  {currencyLabel}
                </p>
                <p className="mt-1 flex items-baseline justify-center gap-1 text-2xl font-black tabular-nums text-white">
                  {price?.toLocaleString("en-US") ?? "—"}
                  <span className="text-xs font-normal text-zinc-400">pts</span>
                </p>
              </div>
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
                  className={`w-full whitespace-nowrap rounded-full font-bold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500 ${
                    compact ? "h-8 px-2 text-xs" : "h-11 max-w-xs px-5 text-sm"
                  }`}
                  style={{
                    backgroundColor:
                      price !== null && balance !== null && balance >= price
                        ? product.cardColor
                        : undefined,
                  }}
                  title={
                    price === null
                      ? `This product is not available for ${currencyLabel}.`
                      : undefined
                  }
                >
                  {compact
                    ? busy === currency
                      ? "…"
                      : `${price?.toLocaleString("en-US") ?? "—"} pts`
                    : busy === currency
                      ? "Buying…"
                      : price === null
                        ? "Unavailable"
                        : balance === null
                          ? "Balance unavailable"
                          : balance < price
                            ? "Not enough"
                            : product.addToInventory
                              ? "Buy"
                              : "Buy & use"}
                </button>
              ) : (
                <Link
                  href="/dashboard?view=user&tab=account"
                  className={`inline-flex w-full items-center justify-center rounded-full bg-zinc-800 font-semibold hover:bg-zinc-700 ${
                    compact ? "min-h-8 px-2 text-xs" : "min-h-11 max-w-xs px-4 text-sm"
                  }`}
                >
                  Link account
                </Link>
              )
            ) : (
              <Link
                href="/login"
                className={`inline-flex w-full items-center justify-center rounded-full px-2 font-semibold text-white hover:brightness-110 ${
                  compact ? "min-h-8 text-xs" : "min-h-11 max-w-xs text-sm"
                }`}
                style={{ backgroundColor: product.cardColor }}
              >
                Sign in
              </Link>
            )}
          </div>
        )}
      </div>
    </article>
  );
}
