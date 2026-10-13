import Link from "next/link";
import { Platform } from "@prisma/client";
import {
  getProfanityCategoryRankings,
  getGamblingRanking,
  getProfanityRanking,
} from "@/lib/community-leaderboards";
import { getPointRanking } from "@/lib/points";
import { prisma } from "@/lib/prisma";

export default async function LeaderboardsPage() {
  const [
    overall,
    twitch,
    discord,
    statistics,
    profanity,
    profanityCategories,
    twitchGambling,
    discordGambling,
  ] =
    await Promise.all([
    getPointRanking("overall", 50),
    getPointRanking("twitch", 50),
    getPointRanking("discord", 50),
    prisma.statistic.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    getProfanityRanking(50),
    getProfanityCategoryRankings(50),
    getGamblingRanking(Platform.twitch, 50),
    getGamblingRanking(Platform.discord, 50),
  ]);

  const statisticRankings = await Promise.all(
    statistics.map(async (statistic) => {
      const totals = await prisma.statisticEvent.groupBy({
        by: ["entity_id"],
        where: { statistic_id: statistic.id },
        _sum: { value: true },
        orderBy: { _sum: { value: "desc" } },
        take: 50,
      });
      const entities = await prisma.entity.findMany({
        where: { id: { in: totals.map((row) => row.entity_id) } },
        select: { id: true, name: true },
      });
      const names = new Map(entities.map((entity) => [entity.id, entity.name]));
      return {
        name: statistic.name,
        entries: totals.map((row) => ({
          name: names.get(row.entity_id) ?? "Neznámý uživatel",
          points: row._sum.value ?? 0,
        })),
      };
    }),
  );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="text-xl font-black tracking-widest">N4JT</Link>
          <Link href="/" className="text-sm font-semibold text-violet-300 hover:text-violet-200">
            ← Zpět na hlavní stránku
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-14">
        <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">
          Komunita
        </p>
        <h1 className="mt-3 text-4xl font-black sm:text-5xl">Všechny žebříčky</h1>
        <p className="mt-3 max-w-2xl text-zinc-400">
          Body i statistiky komunity na jednom místě. Další textové statistiky se tu objeví,
          jakmile je začneme počítat.
        </p>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <Ranking title="Celkem bodů" entries={overall} />
          <Ranking title="Twitch CustomBody" entries={twitch} />
          <Ranking title="Discord body" entries={discord} />
          <Ranking
            title="Nejvíc vulgarismů"
            entries={profanity.map((entry) => ({
              name: entry.name,
              points: entry.total,
            }))}
          />
          {profanityCategories.map((ranking) => (
            <Ranking
              key={ranking.category}
              title={`Skóre · ${ranking.category}`}
              entries={ranking.entries.map((entry) => ({
                name: entry.name,
                points: entry.total,
              }))}
            />
          ))}
          <Ranking
            title="Nejvíc vsazeno · Twitch"
            entries={twitchGambling.map((entry) => ({
              name: entry.name,
              points: entry.total,
            }))}
          />
          <Ranking
            title="Nejvíc vsazeno · Discord"
            entries={discordGambling.map((entry) => ({
              name: entry.name,
              points: entry.total,
            }))}
          />
          {statisticRankings.map((ranking) => (
            <Ranking key={ranking.name} title={ranking.name} entries={ranking.entries} />
          ))}
        </section>
      </div>
    </main>
  );
}

function Ranking({
  title,
  entries,
}: {
  title: string;
  entries: Array<{ name: string; points: number }>;
}) {
  return (
    <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      <ol className="mt-3 divide-y divide-zinc-800">
        {entries.map((entry, index) => (
          <li key={`${entry.name}-${index}`} className="flex items-center justify-between gap-3 py-3">
            <span className="flex min-w-0 items-center gap-3">
              <span className="w-7 shrink-0 text-sm font-bold text-zinc-500">{index + 1}.</span>
              <span className="truncate font-medium">{entry.name}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {entry.points.toLocaleString("cs-CZ")}
            </span>
          </li>
        ))}
        {entries.length === 0 && (
          <li className="py-5 text-sm text-zinc-500">Zatím nejsou žádná data.</li>
        )}
      </ol>
    </section>
  );
}
