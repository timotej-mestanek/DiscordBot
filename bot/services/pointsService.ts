import { prisma } from "../lib/prisma";
import { createUser } from "./userService";

export default async function getUserPoints(userId: string) {
    const user = await prisma.discordEntity.findUnique({ where: { discord_id: userId } });
    console.log("toto je user", user);
    return user?.points;
}

export async function addPoints(userId: string, points: number) {
    try{
 const user = await prisma.discordEntity.findUnique({ where: { discord_id: userId } });
    if (user) {
        await prisma.discordEntity.update({ where: { discord_id: userId }, data: { points: user.points + points } });
    }else{
        await createUser(userId);
        await prisma.discordEntity.update({ where: { discord_id: userId }, data: { points: points } });
    }
    return `Body byly pricteny, aktualni hodnota je ${(user?.points || 0) + points}`;
    }
    catch(e){
        return "neco se nepovedlo";
    }

}

export async function removePoints(userId: string, points: number) {
    const user = await prisma.discordEntity.findUnique({ where: { discord_id: userId } });
    if (user) {
        await prisma.discordEntity.update({ where: { discord_id: userId }, data: { points: user.points - points } });
    }
}


export async function getTableFromPoints() {
    const users = await prisma.discordEntity.findMany({ orderBy: { points: "desc" }, take: 10 });
    return users;
}