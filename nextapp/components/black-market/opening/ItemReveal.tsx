"use client";

import Image from "next/image";
import type { OpenCrateResult } from "@/lib/black-market/actions";

export default function ItemReveal({
  result,
  onClose,
}: {
  result: Exclude<OpenCrateResult, { type: "error" }>;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-950/55 p-5 backdrop-blur-sm">
      {result.type === "duplicate" ? (
        <section
          aria-live="polite"
          className="w-full max-w-sm animate-[item-reveal_500ms_cubic-bezier(.16,1,.3,1)_both] rounded-3xl border border-amber-500/60 bg-zinc-950/95 p-8 text-center shadow-2xl shadow-amber-500/20"
        >
          <p className="text-7xl" aria-hidden="true">🥚</p>
          <h2 className="mt-4 text-4xl font-black text-amber-100">
            +{result.goldenEggsGained}
          </h2>
          <p className="mt-2 text-lg font-bold text-amber-200">Golden Eggs</p>
          <p className="mt-2 text-sm text-zinc-400">Duplicate item</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-7 w-full rounded-xl bg-violet-600 px-5 py-3 font-bold text-white hover:bg-violet-500"
          >
            Nice!
          </button>
        </section>
      ) : (
        <section
          aria-live="polite"
          className="w-full max-w-sm animate-[item-reveal_500ms_cubic-bezier(.16,1,.3,1)_both] rounded-3xl border border-violet-500/50 bg-zinc-950/95 p-5 text-center shadow-2xl shadow-violet-500/20"
        >
          <div className="relative mx-auto aspect-square w-full max-w-[19rem] overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-900">
            {result.imageUrl ? (
              <Image
                src={result.imageUrl}
                alt={result.itemName}
                fill
                unoptimized
                sizes="(max-width: 640px) 90vw, 304px"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-6xl text-zinc-700" aria-hidden="true">◇</div>
            )}
          </div>
          <h2 className="mt-5 text-2xl font-black text-white">{result.itemName}</h2>
          <p className="mt-1 text-sm font-semibold text-emerald-300">Added to inventory!</p>
          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-xl bg-violet-600 px-5 py-3 font-bold text-white hover:bg-violet-500"
          >
            Nice!
          </button>
        </section>
      )}
      <style jsx>{`
        @keyframes item-reveal {
          from { opacity: 0; transform: translateY(90px) scale(0.45); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
