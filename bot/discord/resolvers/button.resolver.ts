import { ButtonInteraction, Interaction } from "discord.js";
import { ModalWindow } from "@shared/ui";
export const buttonResolver = async(interaction:ButtonInteraction) =>{ 
   

    switch(interaction.customId){
        case "buy_1000_tp":
            await interaction.showModal(ModalWindow())
            break;
    }
}