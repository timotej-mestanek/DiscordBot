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
  _count: { inventory: number; redemptions: number };
};

export default function ShopAdminManager({
  products,
}: {
  products: AdminShopProduct[];
}) {
  const [selected, setSelected] = useState<AdminShopProduct | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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

  return (
    <section className="mt-8 rounded-2xl border border-violet-900/60 bg-violet-950/10 p-5 sm:p-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
        Shop administration
      </p>
      <h2 className="mt-2 text-xl font-bold">Manage shop products</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">
        Manage all products in one editor. Select a product or create a new one.
        A product is either added to inventory or consumed immediately after purchase.
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
    </section>
  );
}
