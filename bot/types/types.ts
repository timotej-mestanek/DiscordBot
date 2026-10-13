import { Message, OmitPartialGroupDMChannel } from "discord.js";

export type DMes = OmitPartialGroupDMChannel<Message<boolean>>

export type TopPoints = { 
    discord_id:string;
    name:string;
    points:number;
}
