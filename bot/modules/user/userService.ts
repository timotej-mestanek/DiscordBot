import { prisma } from "../lib/prisma";

export async function getUser(userId: string) {
    const user = await prisma.discordEntity.findUnique({ where: { discord_id: userId } });
    return user;
}

export async function createUser(userId: string) {
    const user = await prisma.discordEntity.create({ data: { 
        discord_id: userId,
        name: "", // ZBYTECNOST
        points: 0,
        
    } });
    return user;
}
