import { prisma } from "@/lib/prisma";

export async function getDiscordPoints(userId: string): Promise<number> {
  const user = await prisma.discordEntity.findUnique({
    where: { discord_id: userId },
    select: { points: true },
  });
  return user?.points ?? 0;
}
