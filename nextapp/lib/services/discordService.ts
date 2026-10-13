import { Embed } from "discord.js";

export async function sendEmbed(
  channelId: string,
  embed: Embed
) {
  return fetch(
    `https://discord.com/api/v10/channels/${channelId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bot ${process.env.DISCORD_BOT_TOKEN!}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        embeds: [embed]
      })
    }
  )
}