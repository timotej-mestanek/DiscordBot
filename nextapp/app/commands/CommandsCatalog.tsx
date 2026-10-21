"use client";

import { useMemo, useState } from "react";
import type { TtvCommandGroup, TtvCommandRole } from "@/lib/ttv-commands";

const roleLabels: Record<TtvCommandRole, string> = {
  everyone: "Everyone",
  vip: "VIP",
  mods: "Moderators",
};

const roleFilters: Array<{ id: "all" | TtvCommandRole; label: string }> = [
  { id: "all", label: "All roles" },
  { id: "everyone", label: "Everyone" },
  { id: "vip", label: "VIP" },
  { id: "mods", label: "Moderators" },
];

export default function CommandsCatalog({
  groups,
}: {
  groups: TtvCommandGroup[];
}) {
  const [query, setQuery] = useState("");
  const [activeGroup, setActiveGroup] = useState("all");
  const [activeRole, setActiveRole] =
    useState<(typeof roleFilters)[number]["id"]>("all");

  const filteredGroups = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("en");
    return groups
      .filter((group) => activeGroup === "all" || group.id === activeGroup)
      .map((group) => ({
        ...group,
        commands: group.commands.filter((command) => {
          const matchesRole =
            activeRole === "all" ||
            command.roles.includes("everyone") ||
            command.roles.includes(activeRole);
          const matchesQuery =
            !normalizedQuery ||
            `${command.name} ${command.description} ${command.usage ?? ""} ${group.label}`
              .toLocaleLowerCase("en")
              .includes(normalizedQuery);
          return matchesRole && matchesQuery;
        }),
      }));
  }, [activeGroup, activeRole, groups, query]);

  const visibleCount = filteredGroups.reduce(
    (count, group) => count + group.commands.length,
    0,
  );

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-zinc-900/80 p-4 shadow-2xl shadow-violet-950/20 sm:p-6">
        <label htmlFor="command-search" className="sr-only">
          Search commands
        </label>
        <div className="relative">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-lg text-violet-300"
          >
            ⌕
          </span>
          <input
            id="command-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands or descriptions…"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 py-3.5 pl-12 pr-4 text-sm text-white outline-none transition placeholder:text-zinc-500 focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20"
          />
        </div>
        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveGroup("all")}
            aria-pressed={activeGroup === "all"}
            className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
              activeGroup === "all"
                ? "bg-violet-600 text-white"
                : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
            }`}
          >
            All categories
          </button>
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveGroup(group.id)}
              aria-pressed={activeGroup === group.id}
              className={`shrink-0 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                activeGroup === group.id
                  ? "bg-violet-600 text-white"
                  : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
              }`}
            >
              {group.label}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 pt-4">
          <div className="flex flex-wrap gap-2">
            {roleFilters.map((role) => (
              <button
                key={role.id}
                type="button"
                onClick={() => setActiveRole(role.id)}
                aria-pressed={activeRole === role.id}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  activeRole === role.id
                    ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-200"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                {role.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-zinc-500">
            {visibleCount} {visibleCount === 1 ? "command" : "commands"}
          </p>
        </div>
      </section>

      <div className="mt-7 space-y-8">
        {filteredGroups.map((group) => (
          <section key={group.id} aria-labelledby={`group-${group.id}`}>
            <div className="mb-4">
              <h2
                id={`group-${group.id}`}
                className="text-xl font-bold tracking-tight"
              >
                {group.label}
              </h2>
              <p className="mt-1 text-sm text-zinc-400">{group.description}</p>
            </div>
            {group.commands.length > 0 ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {group.commands.map((command) => (
                  <article
                    key={command.id}
                    className="group rounded-xl border border-zinc-800 bg-zinc-900/70 p-5 transition hover:border-violet-700/70 hover:bg-zinc-900"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <h3 className="font-mono text-lg font-bold text-violet-200">
                        {command.name}
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {command.roles.map((role) => (
                          <span
                            key={role}
                            className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              role === "mods"
                                ? "bg-amber-400/10 text-amber-200"
                                : role === "vip"
                                  ? "bg-fuchsia-400/10 text-fuchsia-200"
                                  : "bg-emerald-400/10 text-emerald-200"
                            }`}
                          >
                            {roleLabels[role]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-zinc-300">
                      {command.description}
                    </p>
                    {command.usage && (
                      <p className="mt-4 rounded-lg border border-zinc-800 bg-zinc-950/80 px-3 py-2 font-mono text-xs text-cyan-200">
                        {command.usage}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-5 text-sm text-zinc-500">
                {query || activeRole !== "all"
                  ? "No commands match your search and selected filters."
                  : "No Twitch commands have been added to this category yet."}
              </p>
            )}
          </section>
        ))}
      </div>
    </>
  );
}
