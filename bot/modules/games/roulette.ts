import type { Message } from "discord.js";
import { lossMessages, winMessages } from "../../shared/data/ruletteMessages";
import { ensureUser } from "../user/userRespository";
import {
  getUserPoints,
  PointsBalanceLimitError,
  settleBet,
} from "../points/pointsRepository";
import {
  getRouletteColor,
  parseRouletteSelection,
  parseStake,
  roulettePayout,
} from "./rules";

export default async function playRoulette(message: Message) {
  const [, rawStake, rawSelection] = message.content.trim().split(/\s+/);
  const stake = parseStake(rawStake);
  const selection = rawSelection
    ? parseRouletteSelection(rawSelection)
    : null;

  if (stake === null || selection === null) {
    await message.reply("Použití: `!ruleta <sázka> <0–36|červená|černá|zelená>`.");
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

  const result = Math.floor(Math.random() * 37);
  const payout = roulettePayout(selection, result, stake);
  let newBalance: number | null;
  try {
    newBalance = await settleBet(message.author.id, stake, payout, {
      sourceEventId: message.id,
      displayName: message.author.globalName ?? message.author.username,
      activity: "roulette",
      outcome: `selection=${selection};result=${result};color=${getRouletteColor(result)}`,
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

  const color = getRouletteColor(result);
  const symbol = color === "red" ? "🔴" : color === "black" ? "⚫" : "🟢";
  const messages = payout > 0 ? winMessages : lossMessages;
  const messageToSend = messages[Math.floor(Math.random() * messages.length)];
  const delta = payout - stake;

  await message.reply(
    `${symbol} Padlo ${result} (${color}). ${messageToSend} ` +
      `${delta >= 0 ? "Vyhrál/a" : "Prohrál/a"} ${Math.abs(delta)} bodů; ` +
      `zůstatek: ${newBalance}.`,
  );
}
