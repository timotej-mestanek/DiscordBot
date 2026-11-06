export type ShopAuditLog = {
  id: string;
  reverted_log_id: string | null;
  action: string;
  details: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function canRevertShopLog(log: ShopAuditLog): boolean {
  if (log.action === "shop.product_created") return true;
  if (!isRecord(log.details)) return false;
  const details = log.details;
  if (log.action === "shop.product_updated") {
    return isRecord(details.before);
  }
  if (log.action === "shop.purchased") {
    return (
      typeof details.productId === "string" &&
      (details.currency === "discord" || details.currency === "twitch_custom") &&
      typeof details.price === "number"
    );
  }
  if (log.action === "shop.redeemed") {
    return (
      typeof details.productId === "string" &&
      typeof details.redemptionId === "string"
    );
  }
  return false;
}
