import { NewsChannel, TextChannel } from "discord.js";
import { client } from "./../../bot";

export const getWritableChannelById = async(channelId:string)=>{
    const channel = client.channels.cache.get(channelId);
    if(channel instanceof TextChannel || channel instanceof NewsChannel){
        return channel;
    }
    return null; 
}
