CREATE TYPE "BlackMarketItemType" AS ENUM ('normal', 'progressive');

ALTER TABLE "BlackMarketItem"
ADD COLUMN "item_type" "BlackMarketItemType" NOT NULL DEFAULT 'progressive',
ADD COLUMN "image_url" TEXT;

UPDATE "BlackMarketItem" AS item
SET "image_url" = level."image_url"
FROM "BlackMarketItemLevel" AS level
WHERE level."item_id" = item."id"
  AND level."level" = 1;
