import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { ShopItem } from './types';

export function createShopLayout(items:ShopItem[]) {
  const embed = new EmbedBuilder()
    .setTitle('Shop')
    .setDescription(
      items.map(i => `• ${i.name} - ${i.price}$`).join('\n')
    );

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId('buy')
        .setLabel('Buy')
        .setStyle(ButtonStyle.Success)
    );

  return {
    embeds: [embed],
    components: [row]
  };
}