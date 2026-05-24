import { MessageFlags, ModalSubmitInteraction, TextInputModalData } from "discord.js";

export const modalResolver = async(interaction:ModalSubmitInteraction) =>{ 
    
    if(interaction.customId == "confirm_buy"){
       const value = interaction.fields.getTextInputValue("confirm_input"); //Modal input doesn't work as there is no value somehow - probably cuz of upload
       console.log("toto je value: ",value);
    }
    if(interaction.customId.startsWith("confirm")){
        await interaction.reply({ content: "Potvrdené", flags:MessageFlags.Ephemeral }) 
    }
}