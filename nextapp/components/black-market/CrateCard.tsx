import Image from "next/image";
import type { BlackMarketCrate } from "./types";

export default function CrateCard({
  crate,
  disabled,
  instanceNumber,
  onOpen,
  onSelectKey,
}: {
  crate: BlackMarketCrate;
  disabled: boolean;
  instanceNumber?: number;
  onOpen: () => void;
  onSelectKey?: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      onContextMenu={(event) => {
        if (!onSelectKey) return;
        event.preventDefault();
        onSelectKey();
      }}
      aria-label={`${crate.name}${instanceNumber ? ` crate ${instanceNumber}` : " crate"}`}
      title={
        disabled
          ? crate.quantity === 0
            ? "You don't have this crate."
            : crate.requiresKey && crate.keyQuantity === 0
              ? "You need a matching key."
              : "This crate is not currently available."
          : undefined
      }
      className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl bg-violet-950/30 p-3 text-violet-200 transition hover:bg-violet-900/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-300 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {crate.previewImageUrl ? (
        <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg sm:h-20 sm:w-20">
          <Image
            src={crate.previewImageUrl}
            alt=""
            fill
            unoptimized
            sizes="80px"
            className="object-contain"
          />
        </span>
      ) : (
        <svg
          viewBox="0 0 48 48"
          fill="none"
          aria-hidden="true"
          className="h-16 w-16 text-violet-300 sm:h-20 sm:w-20"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 17h34v25H7zM4 10h40v7H4zM24 10v32" />
          <path d="M24 10H14a5 5 0 1 1 5-5c0 3 5 5 5 5Zm0 0h10a5 5 0 1 0-5-5c0 3-5 5-5 5Z" />
        </svg>
      )}
      <span className="text-center text-xs font-semibold">
        {crate.name}
        {instanceNumber !== undefined && ` #${instanceNumber}`}
      </span>
      <span className="text-[10px] text-violet-200/70">
        {onSelectKey ? "Right-click to select a key" : "Select crate"}
      </span>
    </button>
  );
}
