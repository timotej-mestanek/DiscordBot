"use client";

import Link from "next/link";
import { useState } from "react";

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
}: {
  initialItems: InventoryEntry[];
}) {
  const [category, setCategory] = useState<Category>("applicable");
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
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 sm:p-6">
      <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
        Inventory
      </p>
      <div className="mt-5 flex flex-wrap gap-2" role="tablist" aria-label="Inventory categories">
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
            className={`rounded-lg px-3 py-2 text-sm font-semibold ${
              category === item.id
                ? "bg-violet-600 text-white"
                : "border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {message && (
        <p role="status" className="mt-4 rounded-lg border border-zinc-700 bg-zinc-950/70 p-3 text-sm text-zinc-200">
          {message}
        </p>
      )}

      <div
        id="inventory-panel"
        role="tabpanel"
        aria-labelledby={`inventory-tab-${category}`}
        className="mt-4"
      >
        {category === "applicable" ? (
          items.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {items.map((item) => (
                <li
                  key={item.product_id}
                  className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="font-semibold">{item.product.name}</h2>
                    <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-xs text-zinc-300">
                      × {item.quantity}
                    </span>
                  </div>
                  {item.product.description && (
                    <p className="mt-2 text-sm leading-6 text-zinc-400">
                      {item.product.description}
                    </p>
                  )}
                  {item.product_id === "custom-led-effect" ? (
                    <Link
                      href="/dashboard?tab=leds"
                      className="mt-4 inline-flex rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500"
                    >
                      Use in LED editor
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled={busyProductId !== null}
                      onClick={() => void redeem(item.product_id)}
                      className="mt-4 rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
                    >
                      {busyProductId === item.product_id ? "Redeeming…" : "Redeem"}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
              You do not have any applicable items yet. Items bought for later use will appear here.
            </p>
          )
        ) : (
          <p className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-4 text-sm text-zinc-400">
            This inventory category is empty for now.
          </p>
        )}
      </div>
    </section>
  );
}
