"use client";

import { useState } from "react";
import type { FormEvent } from "react";

export type AdminShopProduct = {
  id: string;
  name: string;
  description: string;
  discord_price: number | null;
  twitch_price: number | null;
  active: boolean;
  add_to_inventory: boolean;
  streamerbot_action: string;
  _count: { inventory: number; redemptions: number };
};

export type AdminShopDelivery = {
  event_id: string;
  product_id: string;
  account_id: string;
  action_key: string;
  attempts: number;
  last_error: string | null;
  delivered_at: Date | null;
  cancelled_at: Date | null;
  created_at: Date;
  source_log_id: string | null;
  source_action: string | null;
};

export default function ShopAdminManager({
  products,
  deliveries,
}: {
  products: AdminShopProduct[];
  deliveries: AdminShopDelivery[];
}) {
  const [selected, setSelected] = useState<AdminShopProduct | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [revertingEventId, setRevertingEventId] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const discordPrice = String(form.get("discordPrice") ?? "").trim();
    const twitchPrice = String(form.get("twitchPrice") ?? "").trim();
    const payload = {
      productId: selected?.id,
      name: String(form.get("name") ?? ""),
      description: String(form.get("description") ?? ""),
      discordPrice: discordPrice ? Number(discordPrice) : null,
      twitchPrice: twitchPrice ? Number(twitchPrice) : null,
      active: form.get("active") === "true",
      addToInventory: form.get("addToInventory") === "true",
      streamerbotAction: String(form.get("streamerbotAction") ?? ""),
    };
    try {
      const response = await fetch("/api/shop/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "The product could not be saved.");
        return;
      }
      window.location.reload();
    } catch (requestError) {
      console.error("Shop admin save failed:", requestError);
      setError("The product could not be saved.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelDelivery(delivery: AdminShopDelivery) {
    if (!delivery.source_log_id) return;
    setError("");
    setRevertingEventId(delivery.event_id);
    try {
      const response = await fetch("/api/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "shop-revert",
          logId: delivery.source_log_id,
        }),
      });
      const result: { error?: string } = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Could not cancel and revert this delivery.");
        return;
      }
      window.location.reload();
    } catch (requestError) {
      console.error("Shop delivery cancellation failed:", requestError);
      setError("Could not cancel and revert this delivery.");
    } finally {
      setRevertingEventId(null);
    }
  }

  return (
    <section className="mt-8 rounded-2xl border border-violet-900/60 bg-violet-950/10 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
        Shop administration
      </p>
      <h2 className="mt-2 text-xl font-bold">Manage shop products</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Manage all products in one editor. Select a product or create a new one.
        Set an action key that Streamer.bot receives when an item is used. Items
        bought for inventory are sent only when redeemed.
      </p>

      <div className="mt-5 flex flex-wrap gap-2">
        {products.map((product) => (
          <button
            key={product.id}
            type="button"
            onClick={() => {
              setSelected(product);
              setError("");
            }}
            className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
              selected?.id === product.id
                ? "border-violet-500 bg-violet-950 text-white"
                : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            Edit: {product.name}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setError("");
          }}
          className={`rounded-lg border px-3 py-2 text-sm font-semibold ${
            selected === null
              ? "border-violet-500 bg-violet-950 text-white"
              : "border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          + New product
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
          {error}
        </p>
      )}

      <form
        key={selected?.id ?? "new"}
        onSubmit={save}
        className="mt-5 grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4 sm:grid-cols-2"
      >
        <label className="text-xs font-medium text-zinc-400 sm:col-span-2">
          Product name
          <input
            name="name"
            required
            maxLength={80}
            defaultValue={selected?.name ?? ""}
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs font-medium text-zinc-400 sm:col-span-2">
          Shop description
          <textarea
            name="description"
            maxLength={500}
            rows={2}
            defaultValue={selected?.description ?? ""}
            className="mt-1 w-full resize-y rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs font-medium text-zinc-400 sm:col-span-2">
          Streamer.bot action key
          <input
            name="streamerbotAction"
            required
            maxLength={100}
            defaultValue={selected?.streamerbot_action ?? "shop.redeemed"}
            placeholder="shop.redeemed"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
          <span className="mt-1 block text-zinc-500">
            Enter the exact Streamer.bot action name to run. The action receives the product and buyer details.
          </span>
        </label>
        <label className="text-xs font-medium text-zinc-400">
          Price · Discord points
          <input
            name="discordPrice"
            type="number"
            min="1"
            max="1000000000"
            defaultValue={selected?.discord_price ?? ""}
            placeholder="Not available"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs font-medium text-zinc-400">
          Price · Twitch CustomBody
          <input
            name="twitchPrice"
            type="number"
            min="1"
            max="1000000000"
            defaultValue={selected?.twitch_price ?? ""}
            placeholder="Not available"
            className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </label>
        <label className="text-xs font-medium text-zinc-400">
          Purchase behavior
          <select
            name="addToInventory"
            defaultValue={String(selected?.add_to_inventory ?? false)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            <option value="false">Use immediately; do not add to inventory</option>
            <option value="true">Add to inventory for later use</option>
          </select>
        </label>
        <label className="text-xs font-medium text-zinc-400">
          Status
          <select
            name="active"
            defaultValue={String(selected?.active ?? false)}
            className="mt-1 block w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
          >
            <option value="true">Available in shop</option>
            <option value="false">Hidden</option>
          </select>
        </label>
        {selected && (
          <p className="flex items-end text-xs text-zinc-500">
            {selected._count.inventory} inventories · {selected._count.redemptions} redemptions
          </p>
        )}
        <button
          disabled={busy}
          className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50 sm:col-span-2"
        >
          {busy ? "Saving…" : selected ? "Save product" : "Create product"}
        </button>
      </form>
      <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-950/50 p-4">
        <h3 className="font-semibold">Streamer.bot delivery queue</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Events remain queued until the authenticated Streamer.bot bridge acknowledges them.
          Only deliveries that have not started can be cancelled safely.
        </p>
        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
            {error}
          </p>
        )}
        <ol className="mt-3 divide-y divide-zinc-800">
          {deliveries.map((delivery) => (
            <li key={delivery.event_id} className="py-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">
                  {delivery.product_id} · {delivery.action_key}
                </span>
                <span
                  className={
                    delivery.cancelled_at
                      ? "text-zinc-400"
                      : delivery.delivered_at
                        ? "text-emerald-300"
                        : "text-amber-300"
                  }
                >
                  {delivery.cancelled_at
                    ? "Cancelled"
                    : delivery.delivered_at
                      ? "Delivered"
                      : "Queued"}
                </span>
              </div>
              <p className="mt-1 break-all font-mono text-xs text-zinc-500">
                {delivery.event_id}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                Attempts: {delivery.attempts}
                {delivery.last_error ? ` · Last error: ${delivery.last_error}` : ""}
              </p>
              {!delivery.cancelled_at &&
                !delivery.delivered_at &&
                delivery.attempts === 0 &&
                delivery.source_log_id &&
                (delivery.source_action === "shop.purchased" ||
                  delivery.source_action === "shop.redeemed") && (
                  <button
                    type="button"
                    disabled={revertingEventId !== null}
                    onClick={() => void cancelDelivery(delivery)}
                    className="mt-2 rounded-lg border border-amber-700 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-950/50 disabled:opacity-50"
                  >
                    {revertingEventId === delivery.event_id
                      ? "Cancelling…"
                      : delivery.source_action === "shop.purchased"
                        ? "Refund points & cancel"
                        : "Restore item & cancel"}
                  </button>
                )}
            </li>
          ))}
          {deliveries.length === 0 && (
            <li className="py-3 text-sm text-zinc-500">No delivery events yet.</li>
          )}
        </ol>
      </section>
    </section>
  );
}
