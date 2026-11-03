import Link from "next/link";

export default function AdminViewNotice({
  adminView,
}: {
  adminView: boolean;
}) {
  return (
    <section className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-900/60 bg-violet-950/25 p-4">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-violet-300">
          {adminView ? "Admin mode" : "User mode"}
        </p>
        <p className="mt-1 text-sm text-zinc-300">
          {adminView
            ? "Administration tools are shown separately from the user experience."
            : "You are seeing the application as a regular user."}
        </p>
      </div>
      <Link
        href={
          adminView
            ? "/dashboard?view=user&tab=account"
            : "/dashboard?view=admin"
        }
        className="inline-flex h-10 min-w-44 items-center justify-center rounded-lg border border-violet-700 bg-violet-900/40 px-4 text-sm font-semibold text-violet-100 hover:bg-violet-800/60"
      >
        Switch to {adminView ? "user" : "admin"} view
      </Link>
    </section>
  );
}
