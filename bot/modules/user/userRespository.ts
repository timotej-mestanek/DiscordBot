import { prisma } from "../../lib/prisma";
import { Prisma } from "@prisma/client";

export async function getUser(userId: string) {
    return prisma.discordEntity.findUnique({ where: { discord_id: userId } });
}

export async function createUser(userId: string, name = "") {
    return prisma.discordEntity.create({
        data: {
            discord_id: userId,
            name,
        },
    });
}

export async function ensureUser(
    userId: string,
    name = "",
    existingUser?: Awaited<ReturnType<typeof getUser>>,
) {
    const existing = existingUser === undefined
        ? await getUser(userId)
        : existingUser;
    if (existing) {
        const user = await prisma.discordEntity.update({
            where: { discord_id: userId },
            data: name ? { name } : {},
        });
        return { user, created: false };
    }

    try {
        const user = await createUser(userId, name);
        return { user, created: true };
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === "P2002"
        ) {
            const user = await prisma.discordEntity.update({
                where: { discord_id: userId },
                data: name ? { name } : {},
            });
            return { user, created: false };
        }
        throw error;
    }
}

export async function getLinkedTwitchName(discordId: string) {
    const connection = await prisma.discordTwitchConnection.findUnique({
        where: { discord_id: discordId },
        select: { twitch_id: true, twitch_name: true },
    });

    if (connection?.twitch_id) {
        return connection.twitch_name;
    }

    if (connection) return null;

    const entity = await prisma.entity.findUnique({
        where: { discord_id: discordId },
        select: { name: true, twitch_id: true },
    });

    if (!entity?.twitch_id) return null;

    const twitchEntity = await prisma.twitchEntity.findUnique({
        where: { twitch_id: entity.twitch_id },
        select: { name: true },
    });

    return twitchEntity?.name || entity.name;
}
