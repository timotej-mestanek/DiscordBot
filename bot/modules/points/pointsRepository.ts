import { prisma } from "../../lib/prisma";

export const getUserPoints = async (userId: string) => {
  const user = await prisma.discordEntity.findUnique({
    where: { discord_id: userId },
  });

  return user?.points ?? 0;
};

export const getTopUsers = async (take = 10) => {
  return prisma.discordEntity.findMany({
    orderBy: { points: "desc" },
    take,
  });
};

export const incrementPoints = async (userId: string,amount: number) => {
  return prisma.discordEntity.update({
    where: { discord_id: userId },
    data: {
      points: {
        increment: amount,
      },
    },
  });
};

export const decrementPoints = async (userId: string,amount: number) => {
  return prisma.discordEntity.update({
    where: { discord_id: userId },
    data: {
      points: {
        decrement: amount,
      },
    },
  });
};
