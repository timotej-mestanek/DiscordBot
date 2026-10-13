import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  TextChannel,
} from "discord.js";
import { authChannelId, webBaseUrl } from "../../config";
import { client } from "../client";

const PANEL_MARKER = "discord-twitch-auth-panel";

export async function syncAuthPanel(): Promise<void> {
  if (!authChannelId) {
    console.log("Discord auth panel is disabled; set DISCORD_AUTH_CHANNEL_ID.");
    return;
  }
  if (!webBaseUrl) {
    throw new Error("DISCORD_AUTH_CHANNEL_ID is set but WEB_BASE_URL is missing.");
  }

  const baseUrl = new URL(webBaseUrl);
  if (baseUrl.protocol !== "https:" && baseUrl.protocol !== "http:") {
    throw new Error("WEB_BASE_URL must use HTTP or HTTPS.");
  }

  const channel = await client.channels.fetch(authChannelId);
  if (!(channel instanceof TextChannel)) {
    throw new Error(`Discord auth channel ${authChannelId} is not a message channel.`);
  }

  const discordConnectionsUrl = new URL(
    "/api/auth/discord/connections",
    baseUrl,
  ).toString();
  const separateTwitchUrl = new URL("/api/auth/discord/local", baseUrl).toString();
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel("Twitch z Discord Connections")
      .setStyle(ButtonStyle.Link)
      .setURL(discordConnectionsUrl),
    new ButtonBuilder()
      .setLabel("Twitch samostatně")
      .setStyle(ButtonStyle.Link)
      .setURL(separateTwitchUrl),
  );
  const embed = new EmbedBuilder()
    .setColor(0x5865f2)
    .setTitle("Propojit Discord a Twitch")
    .setDescription(
      "Vyber si způsob ověření Twitch účtu. Použij Twitch propojený v Discordu, nebo ho ověř samostatně.",
    )
    .setFooter({ text: PANEL_MARKER });

  const existing = await channel.messages.fetch({ limit: 100 });
  const panel = existing.find(
    (message) =>
      message.author.id === client.user?.id &&
      message.embeds.some((item) => item.footer?.text === PANEL_MARKER),
  );

  if (panel) {
    await panel.edit({ embeds: [embed], components: [row] });
  } else {
    await channel.send({ embeds: [embed], components: [row] });
  }
}
