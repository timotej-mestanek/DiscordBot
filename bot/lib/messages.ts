import { Message, OmitPartialGroupDMChannel } from "discord.js";
import GamblingGame from "../games/roulette";
import { commands } from "./commands";
import { lossMessages, winMessages } from "./ruletteMessages";
import { writeMessage, writeReply } from "../utils/logger";
import { DMes } from "../types/types";

export default async function sort_messages(message: DMes) {
  if (!message.guild) return; 

  for (const cmd of commands) {
    if (Array.isArray(cmd.allowedChannels) && !cmd.allowedChannels.includes(message.channel.id)) {
      if (message.content.startsWith(cmd.keyword)) {
        writeReply(message, "Tento příkaz tu nemůžeš použít");
      }
      continue; 
    }
    if (message.content.startsWith(cmd.keyword)) {
      const result = await cmd.action(message);
      if (typeof result === "string") {
        writeReply(message, result);
      }
      break;
    }
  }
}

export const generateResponse = (s:"win" | "lose") => {
    const number = Math.floor(Math.random()*40);
    return s == "win" ? winMessages[number] : lossMessages[number];
}