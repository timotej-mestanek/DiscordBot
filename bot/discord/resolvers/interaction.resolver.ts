import { Interaction } from "discord.js";
import { buttonResolver } from "./button.resolver"
import {modalResolver} from "./modal.resolver";

export const InteractionResolver = (interaction:Interaction) => { 
    if(interaction.isButton()){
        return buttonResolver(interaction); 
    }
    if(interaction.isModalSubmit()){
        return modalResolver(interaction);
    }
}

