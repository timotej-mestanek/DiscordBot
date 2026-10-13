import { ButtonInteraction, MessageFlags } from "discord.js";

export const buttonResolver = async (interaction: ButtonInteraction) => {
  if (interaction.customId.startsWith("buy_")) {
    await interaction.reply({
      content: "Obchod je dočasně vypnutý; položky budou doplněny při konverzi.",
      flags: MessageFlags.Ephemeral,
    });
  }
};