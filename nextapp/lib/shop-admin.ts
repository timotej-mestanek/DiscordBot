import { prisma } from "@/lib/prisma";

export async function getAdminShopDeliveries() {
  const deliveries = await prisma.shopDeliveryEvent.findMany({
    orderBy: { created_at: "desc" },
    take: 30,
    select: {
      event_id: true,
      product_id: true,
      account_id: true,
      action_key: true,
      attempts: true,
      last_error: true,
      delivered_at: true,
      cancelled_at: true,
      created_at: true,
    },
  });

  return Promise.all(
    deliveries.map(async (delivery) => {
      if (
        delivery.delivered_at ||
        delivery.cancelled_at
      ) {
        return {
          ...delivery,
          source_log_id: null,
          source_action: null,
        };
      }
      const sourceLog = await prisma.adminAuditLog.findFirst({
        where: {
          action: { in: ["shop.purchased", "shop.redeemed"] },
          target_account_id: delivery.account_id,
          details: {
            path: ["deliveryEventId"],
            equals: delivery.event_id,
          },
        },
        select: { id: true, action: true },
      });
      return {
        ...delivery,
        source_log_id: sourceLog?.id ?? null,
        source_action: sourceLog?.action ?? null,
      };
    }),
  );
}
