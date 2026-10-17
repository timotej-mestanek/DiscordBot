export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startSpotifyExtensionPublisher } = await import(
    "@/lib/extensions/spotify-publisher"
  );
  startSpotifyExtensionPublisher();
}
