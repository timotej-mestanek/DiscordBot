import Image from "next/image";
import Link from "next/link";
import type { BlackMarketInventoryItem } from "./types";

export default function InventoryCard({
  item,
  pending,
  onEquip,
}: {
  item: BlackMarketInventoryItem;
  pending: boolean;
  onEquip: () => void;
}) {
  const currentLevel = item.levels.find(
    (level) => level.level === item.currentLevel,
  );
  const imageUrl = currentLevel?.imageUrl ?? item.imageUrl;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-xl bg-zinc-950/80">
      <div className="relative aspect-[4/3] overflow-hidden bg-zinc-900">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={item.itemType === "progressive" ? `${item.name} level ${item.currentLevel}` : item.name}
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
      <div className="flex flex-1 flex-col p-2.5">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-bold leading-tight">{item.name}</h4>
          <span className="shrink-0 rounded-full bg-violet-950/70 px-1.5 py-0.5 text-[9px] font-bold text-violet-200">
            {item.itemType === "progressive"
              ? `Lv ${item.currentLevel} / ${item.maxLevel}`
              : "Normal"}
          </span>
        </div>
        {item.isEquipped && (
          <span className="mt-1.5 w-fit rounded-full bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-200">
            Equipped
          </span>
        )}
        {item.useInputLabel && item.useInput && (
          <p className="mt-1.5 break-words text-xs text-zinc-400">
            {item.useInputLabel}: {item.useInput}
          </p>
        )}
        {item.expiresAt && (
          <span className="mt-2 text-xs text-amber-300">
            Expires {new Date(item.expiresAt).toLocaleDateString()}
          </span>
        )}
        <div className="mt-auto grid gap-1.5 pt-2.5">
          <button
            type="button"
            disabled={pending || item.isEquipped}
            onClick={onEquip}
            className="rounded-full bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {item.isEquipped ? "In use" : pending ? "Using…" : "Use"}
          </button>
          {item.itemType === "progressive" &&
            (item.currentLevel >= item.maxLevel ? (
              <button
                type="button"
                disabled
                className="rounded-full bg-zinc-800 px-2 py-1.5 text-[11px] font-semibold text-zinc-400"
              >
                MAXED UP
              </button>
            ) : (
              <Link
                href={`/dashboard/inventory/${encodeURIComponent(item.id)}`}
                className="rounded-full bg-violet-600 px-2 py-1.5 text-center text-[11px] font-semibold hover:bg-violet-500"
              >
                Level up
              </Link>
            ))}
        </div>
      </div>
    </article>
  );
}
