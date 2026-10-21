import { getCurrentAccount } from "@/lib/auth/session";
import Link from "next/link";
import LivePointBalance from "@/app/LivePointBalance";
import RankingSwitcher from "@/app/RankingSwitcher";
import {
  StreamLiveBadge,
  StreamSpotifyCard,
  StreamStatusProvider,
} from "@/app/StreamPresence";
import TopClipCard from "@/app/TopClipCard";
import { getAccountPointBalances, getPointRanking } from "@/lib/points";
import { getCachedCurrentPlayback } from "@/lib/services/spotifyService";
import { getTopTwitchClip, getTwitchLiveStatus } from "@/lib/services/twitchPublic";
import { prisma } from "@/lib/prisma";

function safeExternalUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function Home() {
  const [account, rankings, topClip, spotifyAccount, streamStatus, streamEvents] = await Promise.all([
    getCurrentAccount(),
    Promise.all([
      getPointRanking("overall", 10),
      getPointRanking("twitch", 10),
      getPointRanking("discord", 10),
    ]),
    getTopTwitchClip().catch((error: unknown) => {
      console.error("Top-clip overlay is unavailable:", error);
      return null;
    }),
    prisma.streamOverlayIntegration.findUnique({
      where: { id: "streamer" },
      select: { spotify_rt: true },
    }),
    getTwitchLiveStatus().catch((error: unknown) => {
      console.error("Twitch live status is unavailable:", error);
      return null;
    }),
    prisma.streamEvent.findMany({
      where: { starts_at: { gte: new Date() } },
      orderBy: { starts_at: "asc" },
      take: 5,
    }),
  ]);

  const playerBalances = account
    ? await getAccountPointBalances(account.identities)
    : null;
  const playback = await getCachedCurrentPlayback().catch((error: unknown) => {
    console.error("Now-playing overlay is unavailable:", error);
    return null;
  });
  const twitchLogin = process.env.TWITCH_BROADCASTER_LOGIN?.trim() || "n4jtik";
  const twitchUrl = `https://www.twitch.tv/${encodeURIComponent(twitchLogin)}`;
  const discordUrl = safeExternalUrl(process.env.NEXT_PUBLIC_DISCORD_URL);
  const instagramUrl = safeExternalUrl(process.env.NEXT_PUBLIC_INSTAGRAM_URL);
  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-5">
            <Link href="/" className="text-xl font-black tracking-widest">N4JT</Link>
            <Link href="/shop" className="text-sm font-semibold text-zinc-300 hover:text-white">
              Shop
            </Link>
            <Link href="/commands" className="text-sm font-semibold text-zinc-300 hover:text-white">
              Commands
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {playerBalances && <LivePointBalance initial={playerBalances} />}
            <a
              href={account ? "/dashboard" : "/login"}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold hover:bg-violet-500"
            >
              {account ? "My account" : "Sign in"}
            </a>
          </div>
        </div>
      </header>

      <StreamStatusProvider initialStatus={streamStatus?.isLive ?? null}>
      <section className="relative overflow-hidden border-b border-zinc-800">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-900/40 via-zinc-950 to-zinc-950" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6 md:py-28">
          <StreamLiveBadge />
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-violet-300">
            Streaming · community · points
          </p>
          <h1 className="mt-5 max-w-3xl text-5xl font-black tracking-tight sm:text-7xl">
            N4JT<span className="text-violet-400">.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-8 text-zinc-300">
            Welcome to the N4JT community hub. Watch the stream, compare points, and see what is happening.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={twitchUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-violet-600 px-5 py-3 font-semibold hover:bg-violet-500">
              Twitch stream
            </a>
            {discordUrl && (
              <a href={discordUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 px-5 py-3 font-semibold hover:bg-zinc-900">
                Discord community
              </a>
            )}
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel="noreferrer" className="rounded-lg border border-zinc-700 px-5 py-3 font-semibold hover:bg-zinc-900">
                Instagram
              </a>
            )}
          </div>
        </div>
      </section>

      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1.3fr_0.7fr]">
        <RankingSwitcher
          rankings={{
            overall: rankings[0],
            twitch: rankings[1],
            discord: rankings[2],
          }}
        />

        <section className="space-y-4">
          <StreamSpotifyCard
            initialPlayback={playback}
            isAdmin={account?.role === "admin"}
            spotifyConnected={Boolean(spotifyAccount?.spotify_rt)}
          />
          <TopClipCard initialClip={topClip} />
          <section className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-300">
              Schedule
            </p>
            <h2 className="mt-2 text-xl font-bold">Upcoming streams</h2>
            <ol className="mt-4 divide-y divide-zinc-800">
              {streamEvents.map((event) => (
                <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="font-medium">{event.title}</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    {new Date(event.starts_at).toLocaleString("en-GB", {
                      timeZone: "Europe/Prague",
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {event.ends_at &&
                      ` – ${new Date(event.ends_at).toLocaleTimeString("en-GB", {
                        timeZone: "Europe/Prague",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}`}
                  </p>
                </li>
              ))}
              {streamEvents.length === 0 && (
                <li className="py-3 text-sm text-zinc-500">
                  No upcoming streams are scheduled.
                </li>
              )}
            </ol>
          </section>
        </section>
      </div>
      </StreamStatusProvider>

      <footer className="border-t border-zinc-800 px-4 py-6 text-center text-xs text-zinc-500">
        Twitch CustomBody and Discord points are separate currencies. Twitch Channel Points are not processed by this app.
      </footer>
    </main>
  );
}
