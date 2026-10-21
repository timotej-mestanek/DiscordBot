import type { Metadata } from "next";
import Link from "next/link";
import CommandsCatalog from "@/app/commands/CommandsCatalog";
import { ttvCommandGroups } from "@/lib/ttv-commands";

export const metadata: Metadata = {
  title: "Twitch Commands | N4JT",
  description:
    "Browse N4JT Twitch chat commands, including usage and access levels.",
};

export default function CommandsPage() {
  const commandCount = ttvCommandGroups.reduce(
    (count, group) => count + group.commands.length,
    0,
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-black tracking-widest">
            N4JT
          </Link>
          <Link
            href="/api/ttv-commands"
            target="_blank"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-semibold text-zinc-200 transition hover:border-violet-500 hover:text-white"
          >
            JSON API
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16">
        <section className="relative mb-8 overflow-hidden rounded-3xl border border-violet-800/40 bg-gradient-to-br from-violet-950/80 via-zinc-900 to-cyan-950/50 p-7 sm:p-10">
          <div className="pointer-events-none absolute -right-12 -top-24 h-72 w-72 rounded-full bg-violet-500/10 blur-3xl" />
          <p className="relative text-xs font-bold uppercase tracking-[0.28em] text-violet-300">
            Twitch · chat guide
          </p>
          <h1 className="relative mt-3 text-4xl font-black tracking-tight sm:text-5xl">
            Chat commands<span className="text-violet-400">.</span>
          </h1>
          <p className="relative mt-4 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
            Find a command, learn how to use it, and see who can run it.
            Browse commands for everyone, VIPs, and moderators.
          </p>
          <div className="relative mt-6 flex flex-wrap gap-2">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-zinc-200">
              {commandCount} commands
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-semibold text-zinc-200">
              {ttvCommandGroups.length} categories
            </span>
            <a
              href="/api/ttv-commands"
              className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-300/20"
            >
              Grouped JSON ↗
            </a>
          </div>
        </section>

        <CommandsCatalog groups={ttvCommandGroups} />

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5 sm:p-6">
          <h2 className="font-semibold">Want your own command catalogue?</h2>
          <p className="mt-2 text-sm leading-6 text-zinc-400">
            The Twitch extension supports search, access levels, and custom
            categories. Its configuration view can load this JSON in one click
            or import JSON from any website.
          </p>
          <pre className="mt-4 overflow-x-auto rounded-xl border border-zinc-800 bg-black/30 p-4 text-xs leading-5 text-cyan-100">
{`{
  "schemaVersion": 1,
  "groups": [
    {
      "id": "wheels",
      "label": "Wheels",
      "description": "Wheel commands",
      "commands": [
        {
          "id": "wheel",
          "name": "!wheel",
          "description": "Spin the wheel",
          "usage": "!wheel",
          "roles": ["everyone"]
        }
      ]
    }
  ]
}`}
          </pre>
        </section>
      </div>
    </main>
  );
}
