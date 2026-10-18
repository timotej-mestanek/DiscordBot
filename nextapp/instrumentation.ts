export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const [
    { startSpotifyExtensionPublisher },
    { startGameStatsExtensionPublisher },
  ] = await Promise.all([
    import("@/lib/extensions/spotify-publisher"),
    import("@/lib/extensions/gamestats-publisher"),
  ]);
  startSpotifyExtensionPublisher();
  startGameStatsExtensionPublisher();
}
