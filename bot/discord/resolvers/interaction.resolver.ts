import { Interaction } from "discord.js";
import { buttonResolver } from "./button.resolver"

export const InteractionResolver = (interaction:Interaction) => { 
    if(interaction.isButton()){
        return buttonResolver(interaction); 
    }
}