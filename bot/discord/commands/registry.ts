import { PermissionsBitField } from "discord.js";
import { gameChannelIds } from "../../config";
import { addPointsToUser } from "../../modules/points/pointsService";
import { getUserPoints } from "../../modules/points";
import playCoinflip from "../../modules/games/coinflip";
import playDice from "../../modules/games/dice";
import playRoulette from "../../modules/games/roulette";
import { DMes } from "../../types/types";

type Command = {
  keyword: string;
  allowedChannelId?: string;
  action: (message: DMes, args: string[]) => Promise<string | void>;
};

const addPoints: Command["action"] = async (message, args) => {
  if (!message.member?.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
    return "Na přidávání bodů potřebuješ oprávnění Spravovat server.";
  }

  const mention = message.mentions.users.first();
  const targetId = mention?.id ?? args[0];
  const amount = Number(args[1]);
  if (
    !targetId ||
    !/^\d{17,20}$/.test(targetId) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0
  ) {
    return "Použití: `!addpoints <uživatel nebo ID> <kladný počet>`.";
  }

  const result = await addPointsToUser(
    targetId,
    amount,
    mention?.globalName ?? mention?.username ?? "",
  );
  return `Přidáno ${amount} bodů. Nový zůstatek: ${result.points}.`;
};

export const commands: Command[] = [
  {
    keyword: "!ruleta",
    allowedChannelId: gameChannelIds.roulette,
    action: (message) => playRoulette(message),
  },
  {
    keyword: "!kostky",
    allowedChannelId: gameChannelIds.dice,
    action: (message) => playDice(message),
  },
  {
    keyword: "!mince",
    allowedChannelId: gameChannelIds.coinflip,
    action: (message) => playCoinflip(message),
  },
  {
    keyword: "!shop",
    action: async () => "Obchod zatím není dostupný; nabídku doplníme při konverzi.",
  },
  {
    keyword: "!inventory",
    action: async () => "Inventář zatím není dostupný; položky budou součástí konverze.",
  },
  {
    keyword: "!addpoints",
    action: addPoints,
  },
  {
    keyword: "!points",
    action: async (message) =>
      `Tvoje body: ${await getUserPoints(message.author.id)}`,
  },
];
