import {
  Client,
  GatewayIntentBits,
} from "discord.js"
import dotenv from "dotenv";
import sort_messages from "./discord/events/messageHandler";
import { addPointsToUser } from "./modules/points/pointsService";
import { getUser, createUser } from "./modules/user/userRespository";
import { createOrUpdatePointsTable } from "./modules/leaderboard/tables";
dotenv.config();


export const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.once("ready", async() => {
  console.log(`🤖 Bot ready as ${client.user?.tag}`)
    await createOrUpdatePointsTable();
  setInterval(async () => await createOrUpdatePointsTable(), 180000);
})

client.on("messageCreate", async (message) => {
  console.log(message);
  if (message.author.bot) return
  sort_messages(message);
})

client.on("guildMemberAdd", async (member) => {
  const user = await getUser(member.id);
  if (!user) {
    await createUser(member.id);
  }
  await addPointsToUser(member.id, 100);
})

client.login(process.env.DISCORD_BOT_TOKEN)