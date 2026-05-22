import { EmbedBuilder, NewsChannel, TextChannel } from "discord.js";
import { DMes, TopPoints } from "../../types/types";
import { Channel } from "discord.js";
import { client } from "./../../bot";



export const writeMessage = (message: DMes, text:string) => {
    message.channel.send(text); 
}

export const writeReply = (message: DMes, text:string) => {
    message.reply(text); 
}

export const writeTable = async (channelId: string,title:string, table:TopPoints[]) => {
    const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor('Random');


    table.forEach((item,index) => {
        embed.addFields({name:`${index+1}. \u200B \u200B ${item.name.padEnd(10," ")} ${item.points.toString().padStart(10," ")}`,value:"\u200B",inline:false});
    })

    const channel = await client.channels.cache.get(channelId);
    
    if(channel instanceof TextChannel || channel instanceof NewsChannel) {
    const message = await channel.messages.fetch("1465839306248814637");
    if(message){
        const data = await message.edit({ embeds: [embed], allowedMentions: {users:[]} });
        console.log("bylo to updatnuto nehehe");
    }else{
        const data = await channel.send({ embeds: [embed], allowedMentions: {users:[]} });
        console.log(data);
    }
}

}




