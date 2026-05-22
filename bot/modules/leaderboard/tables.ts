import { client } from "../../bot";
import { getTopUsers } from "../points";
import { TopPoints } from "../../types/types";
import { writeTable } from "../../shared/utils/logger";

export const createOrUpdatePointsTable = async() =>{
    const channelId = "1460758971013923011";
    const table = await getTopUsers();
    
  const tableWithNames: TopPoints[] = await Promise.all(
  table.map(async (item, index) => {
    const cachedUser = client.users.cache.get(item.discord_id);
    if (cachedUser) {
      item.name = cachedUser.globalName || cachedUser.username;
    } else {
      try {
        const fetchedUser = await client.users.fetch(item.discord_id);
        item.name = fetchedUser.globalName || fetchedUser.username;
      } catch {
        item.name = "Unknown user";
      }
    }

    const exampleString = `${index + 1}.\u200B \u200B${item.name}${item.points}`;
    console.log("dlzka: ",150 - exampleString.length);
    const lineSpace = "\u2000".repeat(50 - exampleString.length);
    return { ...item, line_space: lineSpace };
  })
);
    const result = await writeTable(channelId, "Top players in points", tableWithNames);
}



