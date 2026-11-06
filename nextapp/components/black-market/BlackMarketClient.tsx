"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";
import { equipItem } from "@/lib/black-market/actions";
import type {
  EquipItemResult,
  OpenCrateResult,
} from "@/lib/black-market/actions";
import CrateCard from "./CrateCard";
import GoldenEggsBalance from "./GoldenEggsBalance";
import InventoryCard from "./InventoryCard";
import CrateOpeningModal from "./opening/CrateOpeningModal";
import WarehouseKeyCard from "./WarehouseKeyCard";
import Toast from "./Toast";
import { errorMessage } from "./error-messages";
import type {
  BlackMarketCrate,
  BlackMarketInventoryItem,
  BlackMarketKey,
} from "./types";

export default function BlackMarketClient({
  accountId,
  initialGoldenEggs,
  initialCrates,
  initialKeys,
  initialInventory,
  view,
}: {
  accountId: string;
  initialGoldenEggs: number;
  initialCrates: BlackMarketCrate[];
  initialKeys: BlackMarketKey[];
  initialInventory: BlackMarketInventoryItem[];
  view: "warehouse" | "progressive";
}) {
  const router = useRouter();
  const [goldenEggs, setGoldenEggs] = useState(initialGoldenEggs);
  const [crates, setCrates] = useState(initialCrates);
  const [keys, setKeys] = useState(initialKeys);
  const [inventory, setInventory] = useState(initialInventory);
  const [page, setPage] = useState(0);
  const [selectedCrateId, setSelectedCrateId] = useState<string | null>(null);
  const [picker, setPicker] = useState<{
    mode: "select-crate" | "select-key";
    crateId: string;
  } | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [inputItem, setInputItem] = useState<BlackMarketInventoryItem | null>(null);

  const selectedCrate =
    crates.find((crate) => crate.id === selectedCrateId) ?? null;
  const pickerCrate = crates.find((crate) => crate.id === picker?.crateId) ?? null;
  const pickerKey = keys.find((key) => key.crateId === picker?.crateId) ?? null;
  function updateCrateQuantity(crateId: string, delta: number, keyDelta = 0) {
    setCrates((current) =>
      current.map((crate) =>
        crate.id === crateId
          ? {
              ...crate,
              quantity: Math.max(0, crate.quantity + delta),
              keyQuantity: Math.max(0, crate.keyQuantity + keyDelta),
            }
          : crate,
      ),
    );
    if (keyDelta !== 0) {
      setKeys((current) =>
        current.flatMap((key) => {
          if (key.crateId !== crateId) return [key];
          const quantity = Math.max(0, key.quantity + keyDelta);
          return quantity > 0 ? [{ ...key, quantity }] : [];
        }),
      );
    }

  }

  function handleCrateSuccess(
    result: Exclude<OpenCrateResult, { type: "error" }>,
  ) {
    if (result.type === "duplicate" || result.type === "eggs") {
      setGoldenEggs(result.totalGoldenEggs);
      router.refresh();
      return;
    }
    if (result.type === "empty") return;

    const newItem: BlackMarketInventoryItem = {
      id: result.itemId,
      name: result.itemName,
      group: result.group,
      itemType: result.itemType,
      imageUrl: result.imageUrl,
      useInputLabel: result.useInputLabel,
      useInput: null,
      maxLevel: result.maxLevel,
      currentLevel: 1,
      isEquipped: false,
      expiresAt: result.expiresAt,
      levels: result.levels.map((level) => ({
        level: level.level,
        imageUrl: level.imageUrl,
        upgradeCost: level.cost,
        description: level.description,
      })),
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
    router.refresh();
  }

  async function handleEquip(
    item: BlackMarketInventoryItem,
    userInput: string | null = null,
  ): Promise<boolean> {
    if (pendingItemId) return false;
    const previousInventory = inventory;
    setPendingItemId(item.id);
    setToast("");
    setInventory((current) =>
      current.map((entry) =>
        entry.group === item.group
          ? {
              ...entry,
              isEquipped: entry.id === item.id,
              useInput: entry.id === item.id ? userInput : entry.useInput,
            }
          : entry,
      ),
    );

    let result: EquipItemResult;
    try {
      result = await equipItem(accountId, item.id, userInput);
    } catch (error) {
      console.error("Black Market equip request failed:", error);
      setInventory(previousInventory);
      setToast(errorMessage("INTERNAL_ERROR"));
      setPendingItemId(null);
      return false;
    }

    setPendingItemId(null);
    if (result.type === "error") {
      setInventory(previousInventory);
      setToast(errorMessage(result.code));
      return false;
    }
    router.refresh();
    return true;
  }

  async function submitEquip(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!inputItem) return;
    const userInput = String(new FormData(event.currentTarget).get("userInput") ?? "");
    if (await handleEquip(inputItem, userInput)) {
      setInputItem(null);
    }
  }

  const sources = [
    ...(view === "warehouse"
      ? [
          ...crates
            .filter((crate) => crate.quantity > 0)
            .map((crate) => ({
              kind: "crate" as const,
              id: crate.id,
              quantity: crate.quantity,
              crate,
            })),
          ...keys
            .filter((key) => key.quantity > 0)
            .map((key) => ({
              kind: "key" as const,
              id: key.crateId,
              quantity: key.quantity,
              key,
            })),
        ]
      : []),
    ...inventory
      .filter((item) =>
        view === "progressive"
          ? item.itemType === "progressive"
          : item.itemType === "normal",
      )
      .map((item) => ({
        kind: "item" as const,
        id: item.id,
        quantity: 1,
        item,
      })),
  ];
  const totalItems = sources.reduce((total, source) => total + source.quantity, 0);
  const pageCount = Math.max(1, Math.ceil(totalItems / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const start = currentPage * 50;
  const end = Math.min(start + 50, totalItems);
  const visibleEntries: Array<
    | { kind: "crate"; key: string; crate: BlackMarketCrate }
    | { kind: "key"; key: string; crateId: string; crateName: string }
    | { kind: "item"; key: string; item: BlackMarketInventoryItem }
  > = [];
  let sourceStart = 0;
  for (const source of sources) {
    const sourceEnd = sourceStart + source.quantity;
    const visibleStart = Math.max(start, sourceStart);
    const visibleEnd = Math.min(end, sourceEnd);
    for (let index = visibleStart; index < visibleEnd; index += 1) {
      const instance = index - sourceStart;
      if (source.kind === "crate") {
        visibleEntries.push({
          kind: "crate",
          key: `crate:${source.id}:${instance}`,
          crate: source.crate,
        });
      } else if (source.kind === "key") {
        visibleEntries.push({
          kind: "key",
          key: `key:${source.id}:${instance}`,
          crateId: source.key.crateId,
          crateName: source.key.crateName,
        });
      } else {
        visibleEntries.push({
          kind: "item",
          key: `item:${source.id}`,
          item: source.item,
        });
      }
    }
    sourceStart = sourceEnd;
    if (sourceStart >= end) break;
  }

  return (
    <>
      <div className="mb-3 flex justify-end">
        <GoldenEggsBalance eggs={goldenEggs} />
      </div>
      {visibleEntries.length > 0 ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {visibleEntries.map((entry) => {
            if (entry.kind === "crate") {
              return (
                <CrateCard
                  key={entry.key}
                  crate={entry.crate}
                  disabled={
                    !entry.crate.available ||
                    (entry.crate.requiresKey && entry.crate.keyQuantity === 0) ||
                    pendingItemId !== null
                  }
                  onOpen={() => {
                    setToast("");
                    if (entry.crate.requiresKey) {
                      setPicker({ mode: "select-key", crateId: entry.crate.id });
                    } else {
                      setSelectedCrateId(entry.crate.id);
                    }
                  }}
                  onSelectKey={() => {
                    setToast("");
                    if (entry.crate.requiresKey) {
                      setPicker({ mode: "select-key", crateId: entry.crate.id });
                    } else {
                      setSelectedCrateId(entry.crate.id);
                    }
                  }}
                />
              );
            }
            if (entry.kind === "key") {
              const crate = crates.find((candidate) => candidate.id === entry.crateId);
              if (!crate) {
                console.error(`Black Market key references missing crate ${entry.crateId}.`);
                return null;
              }
              return (
                <WarehouseKeyCard
                  key={entry.key}
                  crateName={entry.crateName}
                  onUse={() => {
                    setToast("");
                    setPicker({ mode: "select-crate", crateId: entry.crateId });
                  }}
                />
              );
            }
            return (
              <InventoryCard
                key={entry.key}
                item={entry.item}
                pending={pendingItemId !== null}
                onEquip={() => {
                  if (entry.item.useInputLabel) {
                    setInputItem(entry.item);
                  } else {
                    void handleEquip(entry.item);
                  }
                }}
              />
            );
          })}
        </div>
      ) : (
        <p className="rounded-lg bg-zinc-900/70 p-3 text-sm text-zinc-400">
          {view === "progressive"
            ? "You don't have any progressive items yet."
            : "Your warehouse is empty. Visit the Blackmarket Shop to get started."}
        </p>
      )}
      {totalItems > 50 && (
        <nav
          aria-label="Warehouse pages"
          className="mt-4 flex items-center justify-center gap-3"
        >
          <button
            type="button"
            disabled={currentPage === 0}
            onClick={() => setPage(currentPage - 1)}
            className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-700 disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-xs tabular-nums text-zinc-400">
            {currentPage + 1} / {pageCount} · {totalItems} items
          </span>
          <button
            type="button"
            disabled={currentPage >= pageCount - 1}
            onClick={() => setPage(currentPage + 1)}
            className="rounded-full bg-zinc-800 px-3 py-1.5 text-xs font-semibold hover:bg-zinc-700 disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      )}

      <Toast message={toast} onDismiss={() => setToast("")} />

      {inputItem?.useInputLabel && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <form
            onSubmit={submitEquip}
            role="dialog"
            aria-modal="true"
            aria-labelledby="item-use-input-title"
            className="app-fixed-dialog space-y-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-violet-300">
                  Use item
                </p>
                <h2 id="item-use-input-title" className="mt-1 text-xl font-black">
                  {inputItem.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setInputItem(null)}
                className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
            <label className="block space-y-2 text-sm text-zinc-300">
              <span className="block">{inputItem.useInputLabel}</span>
              <input
                name="userInput"
                type="text"
                required
                maxLength={500}
                defaultValue={inputItem.useInput ?? ""}
                className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-white"
              />
            </label>
            <button
              type="submit"
              disabled={pendingItemId !== null}
              className="w-full rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-semibold hover:bg-violet-500 disabled:opacity-50"
            >
              {pendingItemId === inputItem.id ? "Equipping…" : "Save and equip"}
            </button>
          </form>
        </div>
      )}

      {selectedCrate && (
        <CrateOpeningModal
          accountId={accountId}
          crate={selectedCrate}
          onClose={() => setSelectedCrateId(null)}
          onQuantityChange={updateCrateQuantity}
          onSuccess={handleCrateSuccess}
          onError={setToast}
        />
      )}
      {picker && pickerCrate && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/75 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="crate-key-picker-title"
            className="app-fixed-dialog app-fixed-dialog--picker w-full max-w-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-amber-300">
                  {picker.mode === "select-key" ? "Select a key" : "Select a crate"}
                </p>
                <h2 id="crate-key-picker-title" className="mt-1 text-xl font-black">
                  {pickerCrate.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setPicker(null)}
                className="rounded-full bg-zinc-800 px-3 py-1.5 text-sm font-semibold hover:bg-zinc-700"
              >
                Cancel
              </button>
            </div>
            <p className="mt-3 text-sm text-zinc-300">
              {picker.mode === "select-key"
                ? `Choose one of your ${pickerKey?.quantity ?? pickerCrate.keyQuantity} keys.`
                : `Choose one of your ${pickerCrate.quantity} crates.`}
            </p>
            <div className="mt-4 grid max-h-[55dvh] grid-cols-2 gap-3 overflow-y-auto pr-1 sm:grid-cols-3">
              {picker.mode === "select-key"
                ? Array.from(
                    { length: pickerKey?.quantity ?? pickerCrate.keyQuantity },
                    (_, index) => (
                      <WarehouseKeyCard
                        key={`picker-key:${pickerCrate.id}:${index}`}
                        crateName={`${pickerCrate.name} #${index + 1}`}
                        onUse={() => {
                          setPicker(null);
                          setSelectedCrateId(pickerCrate.id);
                        }}
                      />
                    ),
                  )
                : Array.from({ length: pickerCrate.quantity }, (_, index) => (
                    <CrateCard
                      key={`picker-crate:${pickerCrate.id}:${index}`}
                      crate={pickerCrate}
                      instanceNumber={index + 1}
                      disabled={
                        !pickerCrate.available ||
                        (pickerCrate.requiresKey && pickerCrate.keyQuantity < 1)
                      }
                      onOpen={() => {
                        setPicker(null);
                        setSelectedCrateId(pickerCrate.id);
                      }}
                    />
                  ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}
