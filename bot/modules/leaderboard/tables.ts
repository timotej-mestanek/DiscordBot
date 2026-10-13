import { client } from "../../discord/client";
import { getTopUsers } from "../points";
import { TopPoints } from "../../types/types";
import { writeTable } from "../../shared/utils/logger";
import { leaderboardChannelId } from "../../config";

export const createOrUpdatePointsTable = async () => {
  if (!leaderboardChannelId) return;

  const channelId = leaderboardChannelId;
  const table = await getTopUsers();

  const tableWithNames: TopPoints[] = await Promise.all(
    table.map(async (item) => {
      let name = item.name || "Unknown user";
      try {
        const user =
          client.users.cache.get(item.discord_id) ??
          (await client.users.fetch(item.discord_id));
        name = user.globalName || user.username;
      } catch (error) {
        console.error(`Nepodařilo se načíst Discord uživatele ${item.discord_id}:`, error);
      }

      return { ...item, name };
    }),
  );

  await writeTable(channelId, "Top players in points", tableWithNames);
};
