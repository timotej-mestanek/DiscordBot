import type { Message } from "discord.js";
import { ensureUser } from "../user/userRespository";
import {
  getUserPoints,
  PointsBalanceLimitError,
  settleBet,
} from "../points/pointsRepository";
import { dicePayout, parseStake } from "./rules";

export default async function playDice(message: Message) {
  const [, rawStake, rawGuess] = message.content.trim().split(/\s+/);
  const stake = parseStake(rawStake);
  const guess = rawGuess && /^[1-6]$/.test(rawGuess) ? Number(rawGuess) : null;

  if (stake === null || guess === null) {
    await message.reply("Použití: `!kostky <sázka> <číslo 1–6>`.");
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

  const result = Math.floor(Math.random() * 6) + 1;
  const payout = dicePayout(guess, result, stake);
  let newBalance: number | null;
  try {
    newBalance = await settleBet(message.author.id, stake, payout, {
      sourceEventId: message.id,
      displayName: message.author.globalName ?? message.author.username,
      activity: "dice",
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
    `🎲 Padlo ${result}. ${delta >= 0 ? "Vyhrál/a" : "Prohrál/a"} ` +
      `${Math.abs(delta)} bodů; zůstatek: ${newBalance}.`,
  );
}
