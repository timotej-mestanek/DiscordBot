ALTER TABLE "BlackMarketItem"
ADD COLUMN "shop_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "shop_starts_at" TIMESTAMP(3),
ADD COLUMN "shop_ends_at" TIMESTAMP(3),
ADD COLUMN "shop_discord_price" INTEGER,
ADD COLUMN "shop_twitch_price" INTEGER;

CREATE INDEX "BlackMarketItem_shop_enabled_shop_starts_at_shop_ends_at_idx"
ON "BlackMarketItem"("shop_enabled", "shop_starts_at", "shop_ends_at");
