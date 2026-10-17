import { publishExtensionBroadcast } from "@/lib/extensions/pubsub";
import { getCurrentPlayBack } from "@/lib/services/spotifyService";

const POLL_INTERVAL_MS = 10_000;

let isRunning = false;

export function startSpotifyExtensionPublisher(): void {
  if (isRunning) return;

  if (
    !process.env.TWITCH_EXTENSION_ID ||
    !process.env.TWITCH_EXTENSION_SECRET_BASE64 ||
    !process.env.TWITCH_EXTENSION_BROADCASTER_ID
  ) {
    console.error(
      "Spotify Twitch Extension publisher is disabled because PubSub is not configured.",
    );
    return;
  }

  isRunning = true;
  let lastError: string | undefined;

  const poll = async () => {
    try {
      const data = await getCurrentPlayBack();
      await publishExtensionBroadcast({
        type: "spotify",
        updatedAt: new Date().toISOString(),
        data,
      });
      lastError = undefined;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Spotify PubSub error.";
      if (message !== lastError) {
        console.error("Spotify Twitch Extension publish failed:", error);
        lastError = message;
      }
    } finally {
      setTimeout(() => void poll(), POLL_INTERVAL_MS);
    }
  };

  void poll();
}
