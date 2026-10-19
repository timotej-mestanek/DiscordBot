import {
  isExtensionPubSubConfigured,
  publishExtensionBroadcast,
} from "@/lib/extensions/pubsub";
import { prisma } from "@/lib/prisma";
import { getProcessCachedPubgDailyStats } from "@/lib/services/pubg";
import { getTwitchLiveStatus } from "@/lib/services/twitchPublic";

const PUBLISH_INTERVAL_MS = 120_000;
const DEFAULT_PUBG_PLAYER = "N4JTIK";
const TEST_GAME_NAME = "PUBG";

let isRunning = false;

function normalizeGameName(name: string | null): string {
  return name?.toLocaleLowerCase("en-US").replace(/[^a-z0-9]/g, "") ?? "";
}

async function getGameStatsPayload() {
  const liveStatus = await getTwitchLiveStatus();
  const gameName = liveStatus.gameName ?? TEST_GAME_NAME;
  const normalizedGameName = normalizeGameName(gameName);

  const data = {
    stream: { isLive: true },
    game: { id: normalizedGameName || "unknown", name: gameName },
    supported: false,
    players: [] as Array<{
      id: string;
      name: string;
      role: "self" | "teammate";
      kd: number | null;
      stats: Record<string, number | string>;
    }>,
  };

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
      playerNames.map((name) => getProcessCachedPubgDailyStats(name)),
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
        { game: data.game.name, players: data.players.length },
      );
    } catch (error) {
      console.error("Game Stats Twitch Extension publish failed:", error);
    } finally {
      setTimeout(() => void publish(), PUBLISH_INTERVAL_MS);
    }
  };

  void publish();
}
