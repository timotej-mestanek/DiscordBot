import type { GuildMember } from "discord.js";
import { nicknameIcons } from "../../config";
import {
  ensureUser,
  getUser,
  getLinkedTwitchName,
} from "../../modules/user/userRespository";

const MAX_NICKNAME_LENGTH = 32;

function truncate(value: string, maxLength: number): string {
  let result = "";
  for (const character of value) {
    if (result.length + character.length > maxLength) break;
    result += character;
  }
  return result;
}

export function formatPlatformNickname(
  discordName: string,
  twitchName?: string | null,
): string {
  const prefix = `${nicknameIcons.discord} `;
  const cleanDiscordName = discordName.trim() || "Discord user";

  if (!twitchName?.trim()) {
    return prefix + truncate(cleanDiscordName, MAX_NICKNAME_LENGTH - prefix.length);
  }

  const suffixStart = ` (${nicknameIcons.twitch} `;
  const suffixEnd = ")";
  const contentBudget = Math.max(
    0,
    MAX_NICKNAME_LENGTH - prefix.length - suffixStart.length - suffixEnd.length,
  );
  const cleanTwitchName = twitchName.trim();
  let discordBudget = Math.min(cleanDiscordName.length, Math.ceil(contentBudget / 2));
  const twitchBudget = Math.min(cleanTwitchName.length, contentBudget - discordBudget);
  discordBudget = Math.min(
    cleanDiscordName.length,
    contentBudget - twitchBudget,
  );
  const suffixName = truncate(cleanTwitchName, twitchBudget);
  const suffix = suffixName ? `${suffixStart}${suffixName}${suffixEnd}` : "";

  return prefix + truncate(cleanDiscordName, discordBudget) + suffix;
}

export async function syncMemberNickname(
  member: GuildMember,
  discordNameOverride?: string,
): Promise<boolean> {
  const profileName = member.user.globalName?.trim() || member.user.username;
  const currentNickname = member.nickname?.trim();
  const isManagedNickname = currentNickname?.startsWith(`${nicknameIcons.discord} `);
  const storedUser = await getUser(member.id);
  const discordName =
    discordNameOverride?.trim() ||
    (isManagedNickname && storedUser?.name
      ? storedUser.name
      : currentNickname || profileName);
  const { created } = await ensureUser(member.id, discordName, storedUser);
  const twitchName = await getLinkedTwitchName(member.id);
  const nickname = formatPlatformNickname(discordName, twitchName);

  if (member.nickname !== nickname) {
    await member.setNickname(nickname, "Sync Discord/Twitch display name");
  }

  return created;
}
