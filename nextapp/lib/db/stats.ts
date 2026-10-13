import { prisma } from "../prisma";
import { Prisma } from "@prisma/client";
import { GetStatsParams } from "../types";

export const createStat = async (entity_id: number, value: number) => {
  try {
    return await prisma.statisticEvent.create({
      data: {
        statistic_id: 1,
        entity_id,
        value,
      },
    });
  } catch (err) {
    console.error(err);
    throw err;
  }
};

export async function get_stats({ mode, limit = 5, isActive}: GetStatsParams) {
  const where: Prisma.StatisticEventWhereInput = {};

  if (mode === "daily") {
    const now = new Date();

    const from = new Date(now);
    from.setHours(0, 0, 0, 0);

    const to = new Date(now);
    to.setHours(23, 59, 59, 999);

    where.created_at = {
      gte: from,
      lte: to,
    };
  }

  if (mode === "season") {
    // TODO SEASON STATS
  }

  const data = await prisma.statisticEvent.groupBy({
    by: ["entity_id"],
    where,
    _sum: {
      value: true,
    },
    orderBy: {
      _sum: {
        value: "desc",
      },
    },
    take: limit,
  });

  return data.map(d => ({
    entity_id: d.entity_id,
    total: d._sum.value ?? 0,
  }));
}
