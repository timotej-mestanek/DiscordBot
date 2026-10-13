import { DMes } from "../../types/types";
import { commands } from "../commands/registry";
import { recordMessageProfanity } from "../../modules/profanity/chatMetrics";

export default async function sort_messages(message: DMes): Promise<void> {
  if (!message.inGuild() || message.author.bot) return;

  try {
    await recordMessageProfanity(message);
  } catch (error) {
    console.error(
      `Nepodařilo se uložit vulgarismy ze zprávy ${message.id}:`,
      error,
    );
  }

  const [keyword, ...args] = message.content.trim().split(/\s+/);
  const command = commands.find(
    (candidate) => candidate.keyword === keyword?.toLowerCase(),
  );
  if (!command) return;

  if (command.allowedChannelId && message.channel.id !== command.allowedChannelId) {
    await message.reply("Tento příkaz můžeš použít jen v určeném kanálu.");
    return;
  }

  if (
    ["!ruleta", "!kostky", "!mince"].includes(command.keyword) &&
    !command.allowedChannelId
  ) {
    await message.reply(
      `Příkaz ${command.keyword} není nakonfigurován; doplň jeho ID kanálu do \`.env\`.`,
    );
    return;
  }

  try {
    const response = await command.action(message, args);
    if (response) await message.reply(response);
  } catch (error) {
    console.error(`Chyba při zpracování příkazu ${command.keyword}:`, error);
    await message.reply("Příkaz se nepodařilo dokončit. Zkus to později.");
  }
}
