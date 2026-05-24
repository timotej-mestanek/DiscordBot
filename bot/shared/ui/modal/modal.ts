import { ActionRowBuilder,ButtonInteraction,ModalBuilder, TextInputBuilder, TextInputStyle, } from "discord.js"
import { Modal } from "./modal.types"



export const ModalWindow = () =>{ 
    const modal = new ModalBuilder()
  .setCustomId('confirm_buy')
  .setTitle('Je tvuj účet ttv/n4jtik? dej Submit');

const input = new TextInputBuilder()
  .setCustomId('confirm_input')
  .setLabel('Jestli nespoznáváš účet, pošli link')
  .setStyle(TextInputStyle.Short)
  .setPlaceholder("Napiš link ve tvaru https://twitch.tv/nickname")
  .setRequired(false);

  
const row =
  new ActionRowBuilder<TextInputBuilder>()
    .addComponents(input);
modal.addComponents(row);
        return modal;
}