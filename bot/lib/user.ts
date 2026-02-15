import dotenv from "dotenv";
dotenv.config();

export async function getDiscordUser(userId: string) {
  const res = await fetch(`https://discord.com/api/v10/users/${userId}`, {
    headers: {
      "Authorization": `Bot ${process.env.DISCORD_BOT_TOKEN}`,
      "Content-Type": "application/json"
    }
  });

  if (!res.ok) {
    throw new Error(`Discord API error: ${res.status} ${res.statusText}`);
  }

  return await res.json();
}

