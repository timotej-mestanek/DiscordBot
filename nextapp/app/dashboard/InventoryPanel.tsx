"use client";

import Link from "next/link";
import { useState } from "react";
import BlackMarketClient from "@/components/black-market/BlackMarketClient";
import type {
  BlackMarketCrate,
  BlackMarketInventoryItem,
  BlackMarketKey,
} from "@/components/black-market/types";

type InventoryEntry = {
  product_id: string;
  quantity: number;
  product: { name: string; description: string };
};

const categories = [
  { id: "warehouse", label: "Warehouse" },
  { id: "progressive", label: "Progressive items" },
  { id: "applicable", label: "Applicable items" },
] as const;

type Category = (typeof categories)[number]["id"];

export default function InventoryPanel({
  initialItems,
  blackMarket,
}: {
  initialItems: InventoryEntry[];
  blackMarket: {
    accountId: string;
    goldenEggs: number;
    crates: BlackMarketCrate[];
    keys: BlackMarketKey[];
    items: BlackMarketInventoryItem[];
  };
}) {
  const [category, setCategory] = useState<Category>("warehouse");
  const [items, setItems] = useState(initialItems);
  const [busyProductId, setBusyProductId] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function redeem(productId: string) {
    setBusyProductId(productId);
    setMessage("");
    try {
      const response = await fetch("/api/shop/redeem-item", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId }),
      });
      const result: { error?: string; quantity?: number } = await response.json();
      if (!response.ok) {
        setMessage(result.error ?? "The item could not be redeemed.");
        return;
      }
      if (
        typeof result.quantity !== "number" ||
        !Number.isSafeInteger(result.quantity) ||
        result.quantity < 0
      ) {
        setMessage("The item was redeemed, but the updated inventory count is unavailable.");
        window.setTimeout(() => window.location.reload(), 1200);
        return;
      }
      const quantity = result.quantity;
      setItems((current) =>
        current.flatMap((item) =>
          item.product_id !== productId
            ? [item]
            : quantity > 0
              ? [{ ...item, quantity }]
              : [],
        ),
      );
      setMessage("Item redeemed and queued for Streamer.bot.");
    } catch (error) {
      console.error("Inventory item redemption failed:", error);
      setMessage("The item could not be redeemed.");
    } finally {
      setBusyProductId(null);
    }
  }

  return (
    <section>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Inventory categories">
        {categories.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={`inventory-tab-${item.id}`}
            aria-selected={category === item.id}
            aria-controls="inventory-panel"
            onClick={() => {
              setCategory(item.id);
              setMessage("");
            }}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              category === item.id
                ? "bg-violet-600 text-white"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message && (
        <div className="fixed inset-x-0 bottom-0 z-[70] px-3 pb-3 sm:px-6 sm:pb-5">
          <div
            role="status"
            className="mx-auto flex max-w-xl items-center justify-between gap-3 rounded-xl bg-zinc-800 px-4 py-3 text-sm text-white shadow-xl"
          >
            <span>{message}</span>
            <button
              type="button"
              onClick={() => setMessage("")}
              aria-label="Dismiss inventory notification"
              className="shrink-0 rounded-full bg-white/10 px-2 py-1 text-xs font-semibold hover:bg-white/20"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <div
        id="inventory-panel"
        role="tabpanel"
        aria-labelledby={`inventory-tab-${category}`}
        className="mt-2"
      >
        {(category === "warehouse" || category === "progressive") && (
          <BlackMarketClient
            accountId={blackMarket.accountId}
            initialGoldenEggs={blackMarket.goldenEggs}
            initialCrates={blackMarket.crates}
            initialKeys={blackMarket.keys}
            initialInventory={blackMarket.items}
            view={category}
          />
        )}
        {category === "applicable" && (
          <div className="space-y-4">
            {items.length > 0 ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {items.map((item) => (
                  <li
                    key={item.product_id}
                    className="rounded-lg bg-zinc-900/70 p-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <h2 className="font-semibold">{item.product.name}</h2>
                      <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300">
                        × {item.quantity}
                      </span>
                    </div>
                    {item.product.description && (
                      <p className="mt-1 text-xs leading-5 text-zinc-400">
                        {item.product.description}
                      </p>
                    )}
                    {item.product_id === "custom-led-effect" ? (
                      <Link
                        href="/dashboard?view=user&tab=led-editor"
                        className="mt-2 inline-flex rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold hover:bg-violet-500"
                      >
                        Apply custom LED profile
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled={busyProductId !== null}
                        onClick={() => void redeem(item.product_id)}
                        className="mt-2 rounded-full bg-violet-600 px-3 py-1 text-xs font-semibold hover:bg-violet-500 disabled:opacity-50"
                      >
                        {busyProductId === item.product_id ? "Redeeming…" : "Redeem"}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-lg bg-zinc-900/60 p-3 text-sm text-zinc-400">
                No applicable shop items yet.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
