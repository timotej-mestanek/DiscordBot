import { Interaction, MessageFlags } from "discord.js";
import { buttonResolver } from "./button.resolver";
import { modalResolver } from "./modal.resolver";

export const InteractionResolver = async (interaction: Interaction): Promise<void> => {
  try {
    if (interaction.isButton()) {
      await buttonResolver(interaction);
    } else if (interaction.isModalSubmit()) {
      await modalResolver(interaction);
    }
  } catch (error) {
    console.error("Nepodařilo se zpracovat Discord interakci:", error);
    if (!interaction.isRepliable()) return;

    const response = {
      content: "Požadovanou akci se nepodařilo dokončit.",
      flags: MessageFlags.Ephemeral as const,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(response);
    } else {
      await interaction.reply(response);
    }
  }
};
