import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { ShopItem } from './types';

export function createShopLayout(items:ShopItem[]) {
  const embed = new EmbedBuilder()
    .setTitle('Shop');
  const buttons = items.map((i,key) => new ButtonBuilder().setCustomId(key.toString()).setLabel(`${i.name} - ${i.price}`).setStyle(ButtonStyle.Primary))
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
  return {
    embeds: [embed],
    components: [row]
  };
}