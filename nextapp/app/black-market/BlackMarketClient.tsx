"use client";

import Image from "next/image";
import { useState } from "react";
import {
  equipItem,
  openCrate,
  upgradeItem,
} from "@/lib/black-market/actions";
import type {
  EquipItemResult,
  OpenCrateResult,
  UpgradeItemResult,
} from "@/lib/black-market/actions";

type Crate = { id: string; name: string; quantity: number };
type MarketItem = {
  id: string;
  name: string;
  group: string;
  maxLevel: number;
  currentLevel: number;
  equipped: boolean;
  imageUrl: string;
  levels: { level: number; cost: number | null; imageUrl: string }[];
  nextLevel: { level: number; cost: number | null; imageUrl: string } | null;
};
type Reveal =
  | Extract<OpenCrateResult, { type: "item" }>
  | { type: "duplicate" };

function errorText(code: string) {
  const messages: Record<string, string> = {
    NO_CRATES: "You don't have any of this crate left.",
    CRATE_NOT_FOUND: "This crate no longer exists.",
    CRATE_INACTIVE: "This crate is not currently available.",
    NO_ITEMS_IN_CRATE: "This crate doesn't contain any items yet.",
    NOT_OWNED: "You don't own this item.",
    MAX_LEVEL: "This item is already at its maximum level.",
    NOT_ENOUGH_EGGS: "You don't have enough golden eggs.",
    LEVEL_DATA_MISSING: "Upgrade data for this item is missing.",
    UNAUTHENTICATED: "Please sign in again to use the Black Market.",
    FORBIDDEN: "This action isn't allowed for your account.",
    INTERNAL_ERROR: "The Black Market action failed. Please try again.",
  };
  return messages[code] ?? "The Black Market action failed. Please try again.";
}

function ItemImage({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative aspect-square overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
      {src ? (
        <Image
          src={src}
          alt={alt}
          fill
          unoptimized
          sizes="(max-width: 640px) 45vw, (max-width: 1024px) 30vw, 240px"
          className="object-cover"
        />
      ) : (
        <div className="flex h-full items-center justify-center text-4xl text-zinc-700" aria-hidden="true">
          ◇
        </div>
      )}
    </div>
  );
}

function OpenCrateModal({
  crate,
  opening,
  reveal,
  onClose,
  onOpen,
  onOpenAnother,
}: {
  crate: Crate;
  opening: boolean;
  reveal: Reveal | null;
  onClose: () => void;
  onOpen: () => void;
  onOpenAnother: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="open-crate-title"
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Black Market</p>
            <h2 id="open-crate-title" className="mt-2 text-2xl font-bold">{crate.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800">
            Close
          </button>
        </div>
        {reveal?.type === "item" ? (
          <div className="black-market-reveal mt-5">
            <ItemImage src={reveal.imageUrl} alt={`${reveal.itemName} level 1`} />
            <p className="mt-4 text-center text-xl font-bold">{reveal.itemName}</p>
            <p className="mt-1 text-center text-sm text-emerald-300">New item · {reveal.group}</p>
          </div>
        ) : reveal?.type === "duplicate" ? (
          <div className="mt-10 rounded-xl border border-amber-700/60 bg-amber-950/40 p-6 text-center">
            <p className="text-2xl font-black text-amber-200">Duplicate!</p>
            <p className="mt-2 text-lg font-semibold">+50 🥚</p>
            <p className="mt-1 text-sm text-amber-100/70">Converted into golden eggs.</p>
          </div>
        ) : (
          <div className="mt-6 rounded-xl border border-zinc-800 bg-zinc-950 p-5 text-center">
            <p className="text-5xl" aria-hidden="true">▣</p>
            <p className="mt-3 text-sm text-zinc-400">You have {crate.quantity} {crate.quantity === 1 ? "crate" : "crates"}.</p>
          </div>
        )}
        <div className="mt-5 flex justify-end gap-3">
          {reveal && (
            <button type="button" onClick={onOpenAnother} className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold hover:bg-zinc-800">
              Open another
            </button>
          )}
          {!reveal && (
            <button
              type="button"
              onClick={onOpen}
              disabled={opening || crate.quantity < 1}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {opening ? "Opening…" : "Open crate"}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

function UpgradeItemModal({
  item,
  balance,
  pending,
  onClose,
  onUpgrade,
}: {
  item: MarketItem;
  balance: number;
  pending: boolean;
  onClose: () => void;
  onUpgrade: () => void;
}) {
  const next = item.nextLevel;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="upgrade-item-title"
        className="w-full max-w-md rounded-2xl border border-zinc-700 bg-zinc-900 p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Upgrade item</p>
            <h2 id="upgrade-item-title" className="mt-2 text-2xl font-bold">{item.name}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 hover:bg-zinc-800">
            Close
          </button>
        </div>
        {next ? (
          <>
            <div className="black-market-reveal mt-5">
              <ItemImage src={next.imageUrl} alt={`${item.name} level ${next.level}`} />
            </div>
            <p className="mt-4 text-center font-semibold">Level {next.level}</p>
            <p className="mt-1 text-center text-sm text-amber-200">
              Cost: {next.cost?.toLocaleString("en-US") ?? "Unavailable"} 🥚
            </p>
            <p className="mt-1 text-center text-xs text-zinc-500">
              Balance: {balance.toLocaleString("en-US")} 🥚
            </p>
          </>
        ) : (
          <p className="mt-6 text-sm text-zinc-400">This item has no next-level data.</p>
        )}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onUpgrade}
            disabled={pending || !next || !next.cost || next.cost < 1 || balance < (next.cost ?? Infinity)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Upgrading…" : "Confirm upgrade"}
          </button>
        </div>
      </section>
    </div>
  );
}

export default function BlackMarketClient({
  accountId,
  initialGoldenEggs,
  crates: initialCrates,
  initialInventory,
}: {
  accountId: string;
  initialGoldenEggs: number;
  crates: Crate[];
  initialInventory: MarketItem[];
}) {
  const [goldenEggs, setGoldenEggs] = useState(initialGoldenEggs);
  const [crates, setCrates] = useState(initialCrates);
  const [inventory, setInventory] = useState(initialInventory);
  const [selectedCrateId, setSelectedCrateId] = useState<string | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [upgradeItemId, setUpgradeItemId] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const selectedCrate = crates.find((crate) => crate.id === selectedCrateId) ?? null;
  const selectedUpgradeItem =
    inventory.find((item) => item.id === upgradeItemId) ?? null;

  function showError(code: string) {
    setToast(errorText(code));
  }

  async function handleOpenCrate() {
    if (!selectedCrate || opening) return;
    const crateId = selectedCrate.id;
    setOpening(true);
    setToast("");
    setReveal(null);
    setCrates((current) =>
      current.map((crate) =>
        crate.id === crateId ? { ...crate, quantity: crate.quantity - 1 } : crate,
      ),
    );
    let result: OpenCrateResult;
    try {
      result = await openCrate(accountId, crateId);
    } catch (error) {
      console.error("Black Market crate opening request failed:", error);
      setOpening(false);
      setCrates((current) =>
        current.map((crate) =>
          crate.id === crateId ? { ...crate, quantity: crate.quantity + 1 } : crate,
        ),
      );
      showError("INTERNAL_ERROR");
      return;
    }
    setOpening(false);
    if (result.type === "error") {
      setCrates((current) =>
        current.map((crate) =>
          crate.id === crateId ? { ...crate, quantity: crate.quantity + 1 } : crate,
        ),
      );
      showError(result.code);
      return;
    }
    if (result.type === "duplicate") {
      setGoldenEggs(result.totalGoldenEggs);
      setReveal({ type: "duplicate" });
      setToast(`Duplicate converted into ${result.goldenEggsGained} golden eggs.`);
      return;
    }
    const newItem: MarketItem = {
      id: result.itemId,
      name: result.itemName,
      group: result.group,
      maxLevel: result.maxLevel,
      currentLevel: 1,
      equipped: false,
      imageUrl: result.imageUrl,
      levels: result.levels,
      nextLevel:
        result.levels.find((level) => level.level === 2) ?? null,
    };
    setInventory((current) =>
      current.some((item) => item.id === newItem.id)
        ? current
        : [...current, newItem].sort(
            (left, right) =>
              left.group.localeCompare(right.group) ||
              left.name.localeCompare(right.name),
          ),
    );
    setReveal(result);
  }

  async function handleUpgrade() {
    if (!selectedUpgradeItem || pendingItemId) return;
    const item = selectedUpgradeItem;
    const next = item.nextLevel;
    if (!next || !next.cost || next.cost < 1) {
      showError("LEVEL_DATA_MISSING");
      return;
    }
    const oldBalance = goldenEggs;
    setPendingItemId(item.id);
    setToast("");
    setGoldenEggs(oldBalance - next.cost);
    setInventory((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? {
              ...entry,
              currentLevel: next.level,
              imageUrl: next.imageUrl,
              nextLevel:
                entry.levels.find((level) => level.level === next.level + 1) ??
                null,
            }
          : entry,
      ),
    );
    let result: UpgradeItemResult;
    try {
      result = await upgradeItem(accountId, item.id);
    } catch (error) {
      console.error("Black Market item upgrade request failed:", error);
      setPendingItemId(null);
      setGoldenEggs(oldBalance);
      setInventory((current) =>
        current.map((entry) => (entry.id === item.id ? item : entry)),
      );
      showError("INTERNAL_ERROR");
      return;
    }
    setPendingItemId(null);
    if (result.type === "error") {
      setGoldenEggs(oldBalance);
      setInventory((current) =>
        current.map((entry) => (entry.id === item.id ? item : entry)),
      );
      showError(result.code);
      return;
    }
    setGoldenEggs(result.goldenEggsLeft);
    setUpgradeItemId(null);
  }

  async function handleEquip(item: MarketItem) {
    if (pendingItemId) return;
    const oldInventory = inventory;
    setPendingItemId(item.id);
    setToast("");
    setInventory((current) =>
      current.map((entry) =>
        entry.group === item.group
          ? { ...entry, equipped: entry.id === item.id }
          : entry,
      ),
    );
    let result: EquipItemResult;
    try {
      result = await equipItem(accountId, item.id);
    } catch (error) {
      console.error("Black Market item equip request failed:", error);
      setPendingItemId(null);
      setInventory(oldInventory);
      showError("INTERNAL_ERROR");
      return;
    }
    setPendingItemId(null);
    if (result.type === "error") {
      setInventory(oldInventory);
      showError(result.code);
    }
  }

  const groupedInventory = inventory.reduce<Record<string, MarketItem[]>>(
    (groups, item) => {
      (groups[item.group] ??= []).push(item);
      return groups;
    },
    {},
  );

  return (
    <>
      <header className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">Craft · collect · equip</p>
          <h1 className="mt-2 text-4xl font-black sm:text-5xl">Black Market</h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Open crates to collect cosmetics, upgrade their levels, and equip one item in each category.
          </p>
        </div>
        <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-5 py-3">
          <p className="text-xs font-bold uppercase tracking-wider text-amber-200/70">Golden eggs</p>
          <p className="mt-1 text-2xl font-black text-amber-100">{goldenEggs.toLocaleString("en-US")} 🥚</p>
        </div>
      </header>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Mystery drops</p>
            <h2 className="mt-1 text-2xl font-bold">Your crates</h2>
          </div>
        </div>
        {crates.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">No crates yet.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {crates.map((crate) => (
              <article key={crate.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
                <p className="text-xs font-bold uppercase tracking-wider text-violet-300">Crate</p>
                <h3 className="mt-2 min-h-12 font-bold">{crate.name}</h3>
                <p className="mt-1 text-sm text-zinc-400">Owned: {crate.quantity}</p>
                <button
                  type="button"
                  disabled={crate.quantity < 1}
                  onClick={() => {
                    setReveal(null);
                    setToast("");
                    setSelectedCrateId(crate.id);
                  }}
                  className="mt-4 w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Open
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">Collection</p>
          <h2 className="mt-1 text-2xl font-bold">Your inventory</h2>
        </div>
        {inventory.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
            Your inventory is empty — open a crate!
          </p>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedInventory).map(([group, items]) => (
              <section key={group}>
                <h3 className="mb-3 text-lg font-bold capitalize">{group}</h3>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {items.map((item) => (
                    <article key={item.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-3 sm:p-4">
                      <ItemImage src={item.imageUrl} alt={`${item.name} level ${item.currentLevel}`} />
                      <div className="mt-3 flex items-start justify-between gap-2">
                        <div>
                          <h4 className="font-bold leading-tight">{item.name}</h4>
                          <p className="mt-1 text-xs text-zinc-400">
                            Level {item.currentLevel} / {item.maxLevel}
                          </p>
                        </div>
                        {item.equipped && (
                          <span className="shrink-0 rounded-full border border-emerald-700/70 bg-emerald-950/60 px-2 py-1 text-[10px] font-bold uppercase text-emerald-200">
                            Equipped
                          </span>
                        )}
                      </div>
                      <div className="mt-4 grid gap-2">
                        <button
                          type="button"
                          disabled={item.equipped || pendingItemId !== null}
                          onClick={() => void handleEquip(item)}
                          className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {pendingItemId === item.id && !item.equipped ? "Equipping…" : item.equipped ? "Equipped" : "Equip"}
                        </button>
                        <button
                          type="button"
                          disabled={item.currentLevel >= item.maxLevel || pendingItemId !== null}
                          onClick={() => setUpgradeItemId(item.id)}
                          className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {item.currentLevel >= item.maxLevel ? "Max level" : "Upgrade"}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-4 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-xl border border-amber-800 bg-zinc-900 px-4 py-3 text-sm text-amber-100 shadow-xl" role="status" aria-live="polite">
          <div className="flex items-center justify-between gap-3">
            <span>{toast}</span>
            <button type="button" onClick={() => setToast("")} aria-label="Dismiss notification" className="px-1 text-lg leading-none text-zinc-400 hover:text-white">×</button>
          </div>
        </div>
      )}

      {selectedCrate && (
        <OpenCrateModal
          crate={selectedCrate}
          opening={opening}
          reveal={reveal}
          onClose={() => {
            setSelectedCrateId(null);
            setReveal(null);
          }}
          onOpen={() => void handleOpenCrate()}
          onOpenAnother={() => {
            setReveal(null);
            setToast("");
          }}
        />
      )}
      {selectedUpgradeItem && (
        <UpgradeItemModal
          item={selectedUpgradeItem}
          balance={goldenEggs}
          pending={pendingItemId === selectedUpgradeItem.id}
          onClose={() => setUpgradeItemId(null)}
          onUpgrade={() => void handleUpgrade()}
        />
      )}
    </>
  );
}
