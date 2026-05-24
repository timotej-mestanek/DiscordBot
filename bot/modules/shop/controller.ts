import { getWritableChannelById } from "../../discord/services/channel";
import { createShopLayout } from "./layout";

 

const channelId = 1507479631266189472;


export const renderShop = async(channelId:string) =>{
    const elements = [
        {
            name:"1000 TWITCH POINTS",
            price:1000000,
            id:"buy_1000_tp"
        },
        {
            name:"10 250TWITCH POINTS",
            price:10000000,
            id:"buy_10250_tp"
        }
    ];
    const layout = createShopLayout(elements);
    const channel = await getWritableChannelById(channelId);
    if (!channel) return;
    await channel.send(layout);
}