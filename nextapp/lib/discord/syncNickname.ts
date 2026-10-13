const MAX_NICKNAME_LENGTH = 32;

function truncate(value: string, maxLength: number): string {
  let result = "";
  for (const character of value) {
    if (result.length + character.length > maxLength) break;
    result += character;
  }
  return result;
}

function formatNickname(discordName: string, twitchName: string): string {
  const discordIcon = process.env.DISCORD_NICKNAME_ICON?.trim() || "💬";
  const twitchIcon = process.env.TWITCH_NICKNAME_ICON?.trim() || "🟣";
  const prefix = `${discordIcon} `;
  const cleanDiscordName = discordName.trim() || "Discord user";
  const suffixStart = ` (${twitchIcon} `;
  const contentBudget = Math.max(
    0,
    MAX_NICKNAME_LENGTH - prefix.length - suffixStart.length - 1,
  );
  let discordBudget = Math.min(cleanDiscordName.length, Math.ceil(contentBudget / 2));
  const twitchBudget = Math.min(twitchName.length, contentBudget - discordBudget);
  discordBudget = Math.min(cleanDiscordName.length, contentBudget - twitchBudget);
  const twitchSuffix = truncate(twitchName, twitchBudget);
  const suffix = twitchSuffix ? `${suffixStart}${twitchSuffix})` : "";
  return prefix + truncate(cleanDiscordName, discordBudget) + suffix;
}

export async function syncDiscordNickname(
  discordId: string,
  discordName: string,
  twitchName: string,
): Promise<string[]> {
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildIds = (process.env.DISCORD_GUILD_IDS ?? "")
    .split(",")
    .map((guildId) => guildId.trim())
    .filter(Boolean);
  if (!botToken || guildIds.length === 0) {
    const error =
      "Nickname sync is not configured: set DISCORD_BOT_TOKEN and DISCORD_GUILD_IDS in the web environment.";
    console.error(error);
    return [error];
  }

  const nickname = formatNickname(discordName, twitchName);
  const errors: string[] = [];
  let updatedGuildCount = 0;
  for (const guildId of guildIds) {
    try {
      const response = await fetch(
        `https://discord.com/api/v10/guilds/${encodeURIComponent(guildId)}/members/${encodeURIComponent(discordId)}`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bot ${botToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ nick: nickname }),
        },
      );

      if (response.ok) {
        updatedGuildCount += 1;
        continue;
      }
      if (response.status === 404) continue;
      const detail = `Discord nickname update failed for guild ${guildId}: HTTP ${response.status}.`;
      console.error(detail);
      errors.push(detail);
    } catch (error) {
      const detail = `Discord nickname update could not reach guild ${guildId}.`;
      console.error(detail, error);
      errors.push(detail);
    }
  }

  if (updatedGuildCount === 0 && errors.length === 0) {
    const detail = "Discord nickname was not updated because the user is not in any configured guild.";
    console.error(detail);
    errors.push(detail);
  }

  return errors;
}
