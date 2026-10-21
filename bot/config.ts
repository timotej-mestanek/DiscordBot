import "dotenv/config";

const optionalEnv = (name: string) => process.env[name]?.trim() || undefined;

export const gameChannelIds = {
  roulette: optionalEnv("DISCORD_ROULETTE_CHANNEL_ID"),
  dice: optionalEnv("DISCORD_DICE_CHANNEL_ID"),
  coinflip: optionalEnv("DISCORD_COINFLIP_CHANNEL_ID"),
};

export const leaderboardChannelId = optionalEnv("DISCORD_LEADERBOARD_CHANNEL_ID");
export const authChannelId = optionalEnv("DISCORD_AUTH_CHANNEL_ID");
export const funFactChannelId = optionalEnv("DISCORD_FUN_FACT_CHANNEL_ID");
export const webBaseUrl = optionalEnv("WEB_BASE_URL");

export const nicknameIcons = {
  discord: optionalEnv("DISCORD_NICKNAME_ICON") ?? "💬",
  twitch: optionalEnv("TWITCH_NICKNAME_ICON") ?? "🟣",
};

const MAX_POINTS = 2_147_483_647;
const parsedWelcomeBonus = Number(process.env.DISCORD_WELCOME_BONUS ?? 100);
if (
  !Number.isSafeInteger(parsedWelcomeBonus) ||
  parsedWelcomeBonus < 0 ||
  parsedWelcomeBonus > MAX_POINTS
) {
  throw new Error("DISCORD_WELCOME_BONUS musí být nezáporné celé číslo v rozsahu bodů.");
}
export const welcomeBonus = parsedWelcomeBonus;

export function getRequiredEnv(name: string): string {
  const value = optionalEnv(name);
  if (!value) {
    throw new Error(`Chybí povinná proměnná prostředí ${name}.`);
  }
  return value;
}
