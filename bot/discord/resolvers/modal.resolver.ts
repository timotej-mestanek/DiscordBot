import { MessageFlags, ModalSubmitInteraction } from "discord.js";

export const modalResolver = async (interaction: ModalSubmitInteraction) => {
  if (interaction.customId === "confirm_buy") {
    await interaction.reply({
      content: "Obchod je dočasně vypnutý; objednávka nebyla vytvořena.",
      flags: MessageFlags.Ephemeral,
    });
  }
};