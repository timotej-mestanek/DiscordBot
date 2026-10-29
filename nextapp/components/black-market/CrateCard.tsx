import Image from "next/image";
import type { BlackMarketCrate } from "./types";

export default function CrateCard({
  crate,
  disabled,
  onOpen,
}: {
  crate: BlackMarketCrate;
  disabled: boolean;
  onOpen: () => void;
}) {
  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-violet-900/60 bg-zinc-950/90 shadow-xl shadow-black/20">
      <div className="relative flex aspect-[16/10] items-center justify-center overflow-hidden border-b border-white/10 bg-zinc-900">
        {crate.previewImageUrl ? (
          <Image
            src={crate.previewImageUrl}
            alt={`${crate.name} crate`}
            fill
            unoptimized
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 260px"
            className="object-cover"
          />
        ) : (
          <svg
            viewBox="0 0 48 48"
            fill="none"
            className="h-16 w-16 text-violet-300"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M7 17h34v25H7zM4 10h40v7H4zM24 10v32" />
            <path d="M24 10H14a5 5 0 1 1 5-5c0 3 5 5 5 5Zm0 0h10a5 5 0 1 0-5-5c0 3-5 5-5 5Z" />
          </svg>
        )}
        <span className="absolute right-3 top-3 rounded-full border border-emerald-900 bg-emerald-950/90 px-2.5 py-1 text-xs font-bold text-emerald-200">
          × {crate.quantity}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <h3 className="text-lg font-bold">{crate.name}</h3>
        <div
          className="mt-4"
          title={crate.quantity === 0 ? "You don't have this crate." : undefined}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={onOpen}
            className="w-full rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Open
          </button>
        </div>
      </div>
    </article>
  );
}
