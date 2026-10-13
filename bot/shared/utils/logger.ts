import { EmbedBuilder, NewsChannel, TextChannel } from "discord.js";
import { TopPoints } from "../../types/types";
import { client } from "../../discord/client";

export const writeTable = async (
  channelId: string,
  title: string,
  table: TopPoints[],
) => {
  const embed = new EmbedBuilder().setTitle(title).setColor("Random");
  table.forEach((item, index) => {
    embed.addFields({
      name: `${index + 1}. ${item.name} — ${item.points} bodů`,
      value: "\u200B",
      inline: false,
    });
  });

  const channel = await client.channels.fetch(channelId);
  if (!(channel instanceof TextChannel || channel instanceof NewsChannel)) {
    throw new Error(`Kanál ${channelId} neexistuje nebo do něj bot nemůže psát.`);
  }

  const messages = await channel.messages.fetch({ limit: 50 });
  const message = messages.find(
    (candidate) =>
      candidate.author.id === client.user?.id &&
      candidate.embeds[0]?.title === title,
  );
  const payload = { embeds: [embed], allowedMentions: { users: [] } };

  if (message) {
    await message.edit(payload);
  } else {
    await channel.send(payload);
  }
};
