import { NewsChannel, TextChannel } from "discord.js";
import { client } from "../client";

export const getWritableChannelById = async(channelId:string)=>{
    const channel = await client.channels.fetch(channelId);
    if(channel instanceof TextChannel || channel instanceof NewsChannel){
        return channel;
    }
    return null; 
}
