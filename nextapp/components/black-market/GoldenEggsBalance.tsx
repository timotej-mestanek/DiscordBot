export default function GoldenEggsBalance({ eggs }: { eggs: number }) {
  return (
    <div className="rounded-xl border border-amber-700/50 bg-amber-950/30 px-5 py-3">
      <p className="text-xs font-bold uppercase tracking-wider text-amber-200/70">
        Golden eggs
      </p>
      <p className="mt-1 text-2xl font-black text-amber-100">
        {eggs.toLocaleString("en-US")} 🥚
      </p>
    </div>
  );
}
