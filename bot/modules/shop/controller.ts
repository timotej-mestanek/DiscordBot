import { getWritableChannelById } from "../../discord/services/channel";

export const renderShop = async (channelId: string) => {
  const channel = await getWritableChannelById(channelId);
  if (!channel) {
    throw new Error(`Kanál ${channelId} neexistuje nebo do něj bot nemůže psát.`);
  }
  await channel.send("Obchod je dočasně vypnutý; položky budou doplněny při konverzi.");
};
