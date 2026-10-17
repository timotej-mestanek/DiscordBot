import {
  isExtensionPubSubConfigured,
  publishExtensionBroadcast,
} from "@/lib/extensions/pubsub";
import { getCurrentPlayBack } from "@/lib/services/spotifyService";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";

const POLL_INTERVAL_MS = 10_000;

let isRunning = false;

export function startSpotifyExtensionPublisher(): void {
  if (isRunning) return;

  if (!isExtensionPubSubConfigured("spotify")) {
    console.error(
      "Spotify Twitch Extension publisher is disabled because PubSub is not configured.",
    );
    return;
  }

  isRunning = true;
  console.log("Spotify Twitch Extension publisher started.");
  let hasLoggedFirstPublish = false;
  let wasOffline = false;
  let lastError: string | undefined;

  const poll = async () => {
    try {
      const liveStatus = await getTwitchLiveStatus();
      if (!liveStatus.isLive) {
        if (!wasOffline) {
          console.log("Spotify Twitch Extension publish paused while the stream is offline.");
        }
        wasOffline = true;
        lastError = undefined;
        return;
      }

      wasOffline = false;
      const data = await getCurrentPlayBack();
      await publishExtensionBroadcast({
        type: "spotify",
        updatedAt: new Date().toISOString(),
        isLive: true,
        data,
      }, "spotify");
      if (!hasLoggedFirstPublish) {
        console.log(
          "Twitch accepted the first Spotify Extension PubSub broadcast.",
          data?.is_playing && data.item ? "Playback is active." : "No active playback.",
        );
        hasLoggedFirstPublish = true;
      }
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
