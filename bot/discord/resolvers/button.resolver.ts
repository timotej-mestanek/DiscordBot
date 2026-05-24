import { ButtonInteraction, Interaction } from "discord.js";

export const buttonResolver = (interaction:ButtonInteraction) =>{ 
    console.log("this is button interaction",interaction.customId);

    switch(interaction.customId){
        case "buy_1000_tp":
            console.log("1000tp")
            break;
    }
}