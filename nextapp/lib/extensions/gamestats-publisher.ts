import {
  isExtensionPubSubConfigured,
  publishExtensionBroadcast,
} from "@/lib/extensions/pubsub";
import { prisma } from "@/lib/prisma";
import { getCachedPubgDailyStats } from "@/lib/services/pubg";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";

const PUBLISH_INTERVAL_MS = 120_000;
const DEFAULT_PUBG_PLAYER = "N4JTIK";

let isRunning = false;

function normalizeGameName(name: string | null): string {
  return name?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "") ?? "";
}

async function getGameStatsPayload() {
  const liveStatus = await getTwitchLiveStatus();
  const gameName = liveStatus.gameName;
  const normalizedGameName = normalizeGameName(gameName);

  const data = {
    stream: { isLive: liveStatus.isLive },
    game: { id: normalizedGameName || "unknown", name: gameName ?? "Neznámá hra" },
    supported: false,
    players: [] as Array<{
      id: string;
      name: string;
      role: "self" | "teammate";
      kd: number | null;
      stats: Record<string, number | string>;
    }>,
  };

  if (!liveStatus.isLive) return data;

  if (normalizedGameName.includes("pubg")) {
    data.game.id = "pubg";
    data.game.name = gameName ?? "PUBG";
    data.supported = true;

    const settings = await prisma.streamOverlayIntegration.findUnique({
      where: { id: "streamer" },
      select: { pubg_player_name: true, pubg_teammates: true },
    });
    const playerNames = [
      settings?.pubg_player_name ?? DEFAULT_PUBG_PLAYER,
      ...(Array.isArray(settings?.pubg_teammates)
        ? settings.pubg_teammates.filter(
            (name): name is string => typeof name === "string",
          )
        : []),
    ];
    const players = await Promise.all(
      playerNames.map((name) => getCachedPubgDailyStats(name)),
    );
    data.players = players.map((player, index) => ({
      id: index === 0 ? "main" : `teammate-${index}`,
      name: player.player,
      role: index === 0 ? "self" : "teammate",
      kd: player.kd,
      stats: {
        Kills: player.kills,
        Deaths: player.deaths,
        "Ranked zápasy": player.matches,
        "Headshot rate": `${player.headshotRate.toFixed(1)} %`,
        "Nejdelší kill": player.longestKill,
        "Nejvyšší damage": player.mostDamage,
        "Průměrný damage": player.averageDamage,
      },
    }));
  }

  return data;
}

export function startGameStatsExtensionPublisher(): void {
  if (isRunning) return;

  if (!isExtensionPubSubConfigured("gamestats")) {
    console.error(
      "Game Stats Twitch Extension publisher is disabled because PubSub is not configured.",
    );
    return;
  }

  isRunning = true;
  console.log("Game Stats Twitch Extension publisher started (every 2 minutes).");

  const publish = async () => {
    try {
      const data = await getGameStatsPayload();
      await publishExtensionBroadcast(
        {
          type: "gamestats",
          updatedAt: new Date().toISOString(),
          data,
        },
        "gamestats",
      );
      console.log(
        "Game Stats Twitch Extension PubSub broadcast sent.",
        data.stream.isLive ? data.game.name : "Stream offline.",
      );
    } catch (error) {
      console.error("Game Stats Twitch Extension publish failed:", error);
    } finally {
      setTimeout(() => void publish(), PUBLISH_INTERVAL_MS);
    }
  };

  void publish();
}
