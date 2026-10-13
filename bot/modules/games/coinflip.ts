import type { Message } from "discord.js";
import { ensureUser } from "../user/userRespository";
import {
  getUserPoints,
  PointsBalanceLimitError,
  settleBet,
} from "../points/pointsRepository";
import { coinflipPayout, parseStake } from "./rules";

export default async function playCoinflip(message: Message) {
  const [, rawStake, rawGuess] = message.content.trim().split(/\s+/);
  const stake = parseStake(rawStake);
  const guessRaw = rawGuess?.toLowerCase();
  const guess =
    guessRaw === "hlava" || guessRaw === "orel" ? guessRaw : null;

  if (stake === null || guess === null) {
    await message.reply("Použití: `!mince <sázka> <hlava|orel>`.");
    return;
  }

  await ensureUser(
    message.author.id,
    message.author.globalName ?? message.author.username,
  );

  const balance = await getUserPoints(message.author.id);
  if (stake > balance) {
    await message.reply(`Na tuhle sázku nemáš dost bodů. Zůstatek: ${balance}.`);
    return;
  }

  const result = Math.random() < 0.5 ? "hlava" : "orel";
  const payout = coinflipPayout(guess, result, stake);
  let newBalance: number | null;
  try {
    newBalance = await settleBet(message.author.id, stake, payout, {
      sourceEventId: message.id,
      displayName: message.author.globalName ?? message.author.username,
      activity: "coinflip",
      outcome: `guess=${guess};result=${result}`,
    });
  } catch (error) {
    if (error instanceof PointsBalanceLimitError) {
      await message.reply("Výhra by překročila limit zůstatku; sázka nebyla přijata.");
      return;
    }
    throw error;
  }
  if (newBalance === null) {
    await message.reply("Zůstatek se mezitím změnil; sázka nebyla přijata.");
    return;
  }

  const delta = payout - stake;
  await message.reply(
    `🪙 Padla ${result}. ${delta >= 0 ? "Vyhrál/a" : "Prohrál/a"} ` +
      `${Math.abs(delta)} bodů; zůstatek: ${newBalance}.`,
  );
}
