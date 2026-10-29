import Image from "next/image";
import type { BlackMarketInventoryItem } from "./types";

export default function InventoryCard({
  item,
  pending,
  onEquip,
  onUpgrade,
}: {
  item: BlackMarketInventoryItem;
  pending: boolean;
  onEquip: () => void;
  onUpgrade: () => void;
}) {
  const currentLevel = item.levels.find(
    (level) => level.level === item.currentLevel,
  );

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/90 shadow-xl shadow-black/20">
      <div className="relative aspect-square overflow-hidden border-b border-white/10 bg-zinc-900">
        {currentLevel?.imageUrl ? (
          <Image
            src={currentLevel.imageUrl}
            alt={`${item.name} level ${item.currentLevel}`}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-4xl text-zinc-700" aria-hidden="true">
            ◇
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-bold leading-tight">{item.name}</h4>
          <span className="shrink-0 rounded-full border border-violet-800 bg-violet-950/70 px-2 py-1 text-[10px] font-bold text-violet-200">
            Lv {item.currentLevel} / {item.maxLevel}
          </span>
        </div>
        {item.isEquipped && (
          <span className="mt-2 w-fit rounded-full border border-emerald-700/70 bg-emerald-950/60 px-2 py-1 text-[10px] font-bold uppercase text-emerald-200">
            Equipped
          </span>
        )}
        <div className="mt-auto grid gap-2 pt-4">
          <button
            type="button"
            disabled={pending || item.isEquipped}
            onClick={onEquip}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-xs font-semibold hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {item.isEquipped ? "Equipped" : pending ? "Equipping…" : "Equip"}
          </button>
          <button
            type="button"
            disabled={pending || item.currentLevel >= item.maxLevel}
            onClick={onUpgrade}
            className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {item.currentLevel >= item.maxLevel ? "MAX" : "Upgrade"}
          </button>
        </div>
      </div>
    </article>
  );
}
