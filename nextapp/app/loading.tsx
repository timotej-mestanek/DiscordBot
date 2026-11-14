export default function Loading() {
  return (
    <div className="app-navigation-loading" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-5">
        <span className="app-navigation-loader" aria-hidden="true">
          <span />
        </span>
        <div className="text-center">
          <p className="text-sm font-black uppercase tracking-[0.3em] text-white">
            N4JT
          </p>
          <p className="mt-2 text-xs text-zinc-400">Loading…</p>
        </div>
      </div>
    </div>
  );
}
