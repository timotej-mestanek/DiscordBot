"use client";

import type { InventoryAction, UsersData, UserRow } from "@/app/dashboard/users-types";

function QuantityControls({
  name,
  quantity,
  disabled,
  onChange,
}: {
  name: string;
  quantity: number;
  disabled: boolean;
  onChange: (operation: "add" | "remove") => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label={`Remove one ${name}`}
        disabled={disabled || quantity === 0}
        onClick={() => onChange("remove")}
        className="h-8 w-8 rounded-md border border-zinc-700 text-lg hover:bg-zinc-800 disabled:opacity-40"
      >
        −
      </button>
      <span className="w-8 text-center text-sm tabular-nums">{quantity}</span>
      <button
        type="button"
        aria-label={`Add one ${name}`}
        disabled={disabled}
        onClick={() => onChange("add")}
        className="h-8 w-8 rounded-md border border-zinc-700 text-lg hover:bg-zinc-800 disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}

export default function UserInventoryManager({
  user,
  accountId,
  data,
  busy,
  error,
  onClose,
  onAction,
}: {
  user: UserRow;
  accountId: string;
  data: UsersData;
  busy: boolean;
  error: string;
  onClose: () => void;
  onAction: (action: InventoryAction) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-inventory-title"
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-5 shadow-2xl sm:p-7"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-violet-300">
              Inventory
            </p>
            <h2 id="user-inventory-title" className="mt-1 text-2xl font-bold">
              {user.displayName}
            </h2>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
          >
            Close
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-200">
            {error}
          </p>
        )}

        <InventorySection title="Shop inventory">
          {data.shopProducts.map((item) => (
            <InventoryRow key={item.id} name={item.name}>
              <QuantityControls
                name={item.name}
                quantity={user.shopInventory.find((entry) => entry.productId === item.id)?.quantity ?? 0}
                disabled={busy}
                onChange={(operation) => onAction({
                  action: "shop-item",
                  accountId,
                  itemId: item.id,
                  operation,
                })}
              />
            </InventoryRow>
          ))}
          {data.shopProducts.length === 0 && <EmptyInventory />}
        </InventorySection>

        <InventorySection title="Black Market items">
          {data.blackMarketItems.map((item) => {
            const owned = user.blackMarketInventory.find((entry) => entry.itemId === item.id);
            return (
              <InventoryRow
                key={item.id}
                name={item.name}
                detail={owned ? `Level ${owned.level}` : undefined}
              >
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => onAction({
                    action: "black-market-item",
                    accountId,
                    itemId: item.id,
                    operation: owned ? "remove" : "add",
                  })}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                    owned
                      ? "border border-red-900/70 text-red-300 hover:bg-red-950/50"
                      : "border border-emerald-900/70 text-emerald-300 hover:bg-emerald-950/50"
                  }`}
                >
                  {owned ? "Remove" : "Add"}
                </button>
              </InventoryRow>
            );
          })}
          {data.blackMarketItems.length === 0 && <EmptyInventory />}
        </InventorySection>

        <InventorySection title="Crates">
          {data.crates.map((item) => (
            <InventoryRow key={item.id} name={item.name}>
              <QuantityControls
                name={item.name}
                quantity={user.crateInventory.find((entry) => entry.crateId === item.id)?.quantity ?? 0}
                disabled={busy}
                onChange={(operation) => onAction({
                  action: "crate-item",
                  accountId,
                  itemId: item.id,
                  operation,
                })}
              />
            </InventoryRow>
          ))}
          {data.crates.length === 0 && <EmptyInventory />}
        </InventorySection>

        <InventorySection title="Black Market keys">
          {data.crates.filter((crate) => crate.requiresKey).map((crate) => (
            <InventoryRow key={crate.id} name={crate.name}>
              <QuantityControls
                name={`${crate.name} key`}
                quantity={user.keyInventory.find((entry) => entry.crateId === crate.id)?.quantity ?? 0}
                disabled={busy}
                onChange={(operation) => onAction({
                  action: "crate-key",
                  accountId,
                  itemId: crate.id,
                  operation,
                })}
              />
            </InventoryRow>
          ))}
          {data.crates.every((crate) => !crate.requiresKey) && <EmptyInventory />}
        </InventorySection>
      </section>
    </div>
  );
}

function InventorySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="mt-3 divide-y divide-zinc-800 rounded-xl border border-zinc-800">
        {children}
      </div>
    </section>
  );
}

function InventoryRow({
  name,
  detail,
  children,
}: {
  name: string;
  detail?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5">
      <span className="text-sm text-zinc-200">
        {name}
        {detail && <span className="ml-2 text-xs text-zinc-500">{detail}</span>}
      </span>
      {children}
    </div>
  );
}

function EmptyInventory() {
  return <p className="p-3 text-sm text-zinc-500">No items are available.</p>;
}
