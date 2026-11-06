"use client";

export default function WarehouseKeyCard({
  crateName,
  onUse,
}: {
  crateName: string;
  onUse: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onUse}
      onContextMenu={(event) => {
        event.preventDefault();
        onUse();
      }}
      aria-label={`Use ${crateName} key to open a crate`}
      title="Right-click or select to open a crate"
      className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-2 rounded-xl bg-amber-950/20 p-3 text-amber-200 transition hover:bg-amber-900/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-300"
    >
      <svg
        viewBox="0 0 160 160"
        fill="none"
        aria-hidden="true"
        className="h-16 w-16 sm:h-20 sm:w-20"
      >
        <circle cx="55" cy="58" r="32" stroke="currentColor" strokeWidth="13" />
        <path
          d="m78 81 53 53m-18-18 17-17m-35-1 17-17"
          stroke="currentColor"
          strokeWidth="13"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="text-center text-xs font-semibold">{crateName} key</span>
      <span className="text-[10px] text-amber-200/70">Right-click to use</span>
    </button>
  );
}
