import "dotenv/config";
import { client } from "./discord/client";
import sort_messages from "./discord/events/messageHandler";
import { incrementPoints } from "./modules/points/pointsRepository";
import { createOrUpdatePointsTable } from "./modules/leaderboard/tables";
import { InteractionResolver } from "discord/resolvers/interaction.resolver";
import {
  getRequiredEnv,
  leaderboardChannelId,
  welcomeBonus,
} from "./config";
import {
  syncMemberNickname,
} from "./discord/services/nickname";
import { syncAuthPanel } from "./discord/services/authPanel";
import { scheduleDailyFact } from "./modules/interestingFacts/dailyFact";

client.once("clientReady", async () => {
  console.log(`🤖 Bot ready as ${client.user?.tag}`);
  try {
    await syncAuthPanel();
  } catch (error) {
    console.error("Nepodařilo se připravit Discord autorizační panel:", error);
  }
  scheduleDailyFact();
  if (leaderboardChannelId) {
    const updateLeaderboard = () =>
      createOrUpdatePointsTable().catch((error) => {
        console.error("Nepodařilo se aktualizovat žebříček:", error);
      });
    await updateLeaderboard();
    setInterval(() => void updateLeaderboard(), 180_000);
  } else {
    console.error("Žebříček je vypnutý; nastav DISCORD_LEADERBOARD_CHANNEL_ID.");
  }

});

client.on("messageCreate", (message) => {
  void sort_messages(message);
});

client.on("interactionCreate", (interaction) => {
  void InteractionResolver(interaction);
});

client.on("guildMemberAdd", async (member) => {
  try {
    const created = await syncMemberNickname(member);
    if (created && welcomeBonus > 0) {
      await incrementPoints(member.id, welcomeBonus);
    }
  } catch (error) {
    console.error(
      `Nepodařilo se zpracovat nového člena ${member.id} na serveru ${member.guild.id}:`,
      error,
    );
  }
});

client.login(getRequiredEnv("DISCORD_BOT_TOKEN"));