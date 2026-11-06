DROP INDEX "BlackMarketItem_shop_enabled_shop_starts_at_shop_ends_at_idx";

ALTER TABLE "BlackMarketItem"
DROP COLUMN "shop_starts_at",
DROP COLUMN "shop_ends_at";

CREATE INDEX "BlackMarketItem_shop_enabled_idx"
ON "BlackMarketItem"("shop_enabled");
