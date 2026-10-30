"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  equipItem,
  upgradeItem,
} from "@/lib/black-market/actions";
import type {
  EquipItemResult,
  UpgradeItemResult,
} from "@/lib/black-market/actions";
import CrateCard from "./CrateCard";
import GoldenEggsBalance from "./GoldenEggsBalance";
import InventoryGrid from "./InventoryGrid";
import CrateOpeningModal from "./opening/CrateOpeningModal";
import Toast from "./Toast";
import UpgradeItemModal from "./UpgradeItemModal";
import { errorMessage } from "./error-messages";
import type {
  BlackMarketCrate,
  BlackMarketInventoryItem,
} from "./types";

export default function BlackMarketClient({
  accountId,
  initialGoldenEggs,
  initialCrates,
  initialInventory,
}: {
  accountId: string;
  initialGoldenEggs: number;
  initialCrates: BlackMarketCrate[];
  initialInventory: BlackMarketInventoryItem[];
}) {
  const router = useRouter();
  const [goldenEggs, setGoldenEggs] = useState(initialGoldenEggs);
  const [crates, setCrates] = useState(initialCrates);
  const [inventory, setInventory] = useState(initialInventory);
  const [selectedCrateId, setSelectedCrateId] = useState<string | null>(null);
  const [upgradeItemId, setUpgradeItemId] = useState<string | null>(null);
  const [pendingItemId, setPendingItemId] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const selectedCrate =
    crates.find((crate) => crate.id === selectedCrateId) ?? null;
  const selectedUpgradeItem =
    inventory.find((item) => item.id === upgradeItemId) ?? null;

  function updateCrateQuantity(crateId: string, delta: number) {
    setCrates((current) =>
      current.map((crate) =>
        crate.id === crateId
          ? { ...crate, quantity: Math.max(0, crate.quantity + delta) }
          : crate,
      ),
    );
  }

  function handleCrateSuccess(
    result:
      | {
          type: "item";
          itemId: string;
          itemName: string;
          imageUrl: string;
          group: string;
          maxLevel: number;
          levels: { level: number; cost: number | null; imageUrl: string }[];
        }
      | {
          type: "duplicate";
          goldenEggsGained: number;
          totalGoldenEggs: number;
        },
  ) {
    if (result.type === "duplicate") {
      setGoldenEggs(result.totalGoldenEggs);
      return;
    }

    const newItem: BlackMarketInventoryItem = {
      id: result.itemId,
      name: result.itemName,
      group: result.group,
      maxLevel: result.maxLevel,
      currentLevel: 1,
      isEquipped: false,
      levels: result.levels.map((level) => ({
        level: level.level,
        imageUrl: level.imageUrl,
        upgradeCost: level.cost,
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
  }

  async function handleEquip(item: BlackMarketInventoryItem) {
    if (pendingItemId) return;
    const previousInventory = inventory;
    setPendingItemId(item.id);
    setToast("");
    setInventory((current) =>
      current.map((entry) =>
        entry.group === item.group
          ? { ...entry, isEquipped: entry.id === item.id }
          : entry,
      ),
    );

    let result: EquipItemResult;
    try {
      result = await equipItem(accountId, item.id);
    } catch (error) {
      console.error("Black Market equip request failed:", error);
      setInventory(previousInventory);
      setToast(errorMessage("INTERNAL_ERROR"));
      setPendingItemId(null);
      return;
    }

    setPendingItemId(null);
    if (result.type === "error") {
      setInventory(previousInventory);
      setToast(errorMessage(result.code));
      return;
    }
    router.refresh();
  }

  async function handleUpgrade(
    item: BlackMarketInventoryItem,
  ): Promise<boolean> {
    if (pendingItemId) return false;
    const nextLevelNumber = item.currentLevel + 1;
    const nextLevel = item.levels.find(
      (level) => level.level === nextLevelNumber,
    );
    const cost = nextLevel?.upgradeCost;
    if (item.currentLevel >= item.maxLevel) {
      setToast(errorMessage("MAX_LEVEL"));
      return false;
    }
    if (!nextLevel || cost === null || cost === undefined || cost <= 0) {
      setToast(errorMessage("LEVEL_DATA_MISSING"));
      return false;
    }
    if (goldenEggs < cost) {
      setToast(errorMessage("NOT_ENOUGH_EGGS"));
      return false;
    }

    const previousInventory = inventory;
    const previousGoldenEggs = goldenEggs;
    setPendingItemId(item.id);
    setToast("");
    setGoldenEggs(previousGoldenEggs - cost);
    setInventory((current) =>
      current.map((entry) =>
        entry.id === item.id
          ? { ...entry, currentLevel: nextLevelNumber }
          : entry,
      ),
    );

    let result: UpgradeItemResult;
    try {
      result = await upgradeItem(accountId, item.id);
    } catch (error) {
      console.error("Black Market upgrade request failed:", error);
      setInventory(previousInventory);
      setGoldenEggs(previousGoldenEggs);
      setToast(errorMessage("INTERNAL_ERROR"));
      setPendingItemId(null);
      return false;
    }

    setPendingItemId(null);
    if (result.type === "error") {
      setInventory(previousInventory);
      setGoldenEggs(previousGoldenEggs);
      setToast(errorMessage(result.code));
      return false;
    }
    setGoldenEggs(result.goldenEggsLeft);
    router.refresh();
    return true;
  }

  return (
    <>
      <header className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">
            Craft · collect · equip
          </p>
          <h1 className="mt-3 text-4xl font-black sm:text-5xl">
            Black Market
          </h1>
          <p className="mt-3 max-w-2xl text-zinc-400">
            Open crates to collect cosmetics, upgrade their levels, and equip
            one item in each category.
          </p>
        </div>
        <GoldenEggsBalance eggs={goldenEggs} />
      </header>

      <section>
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
            Mystery drops
          </p>
          <h2 className="mt-1 text-2xl font-bold">Your crates</h2>
        </div>
        {crates.length === 0 ? (
          <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
            No crates available right now
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {crates.map((crate) => (
              <CrateCard
                key={crate.id}
                crate={crate}
                disabled={crate.quantity === 0 || pendingItemId !== null}
                onOpen={() => {
                  setToast("");
                  setSelectedCrateId(crate.id);
                }}
              />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-violet-300">
            Collection
          </p>
          <h2 className="mt-1 text-2xl font-bold">Your inventory</h2>
        </div>
        <InventoryGrid
          items={inventory}
          pendingItemId={pendingItemId}
          onEquip={(item) => void handleEquip(item)}
          onUpgrade={(item) => setUpgradeItemId(item.id)}
        />
      </section>

      <Toast
        message={toast}
        onDismiss={() => setToast("")}
      />

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
      {selectedUpgradeItem && (
        <UpgradeItemModal
          item={selectedUpgradeItem}
          goldenEggs={goldenEggs}
          onClose={() => setUpgradeItemId(null)}
          onConfirm={handleUpgrade}
        />
      )}
    </>
  );
}
