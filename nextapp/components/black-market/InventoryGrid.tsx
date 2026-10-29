import InventoryCard from "./InventoryCard";
import type { BlackMarketInventoryItem } from "./types";

export default function InventoryGrid({
  items,
  pendingItemId,
  onEquip,
  onUpgrade,
}: {
  items: BlackMarketInventoryItem[];
  pendingItemId: string | null;
  onEquip: (item: BlackMarketInventoryItem) => void;
  onUpgrade: (item: BlackMarketInventoryItem) => void;
}) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-sm text-zinc-400">
        Your inventory is empty — open a crate to get started!
      </p>
    );
  }

  const groups = items.reduce<Record<string, BlackMarketInventoryItem[]>>(
    (result, item) => {
      (result[item.group] ??= []).push(item);
      return result;
    },
    {},
  );

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([group, groupItems]) => (
        <section key={group}>
          <h3 className="mb-3 text-lg font-bold capitalize">{group}</h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {groupItems.map((item) => (
              <InventoryCard
                key={item.id}
                item={item}
                pending={pendingItemId !== null}
                onEquip={() => onEquip(item)}
                onUpgrade={() => onUpgrade(item)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
