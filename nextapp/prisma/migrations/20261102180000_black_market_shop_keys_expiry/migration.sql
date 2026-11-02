CREATE TYPE "BlackMarketItemExpiry" AS ENUM ('permanent', 'seven_days', 'thirty_days', 'event_end');
CREATE TYPE "ShopProductType" AS ENUM ('standard', 'black_market_crate', 'black_market_key');

UPDATE "BlackMarketCrate"
SET "ends_at" = COALESCE("starts_at", "created_at") + INTERVAL '30 days'
WHERE "ends_at" IS NULL;

ALTER TABLE "BlackMarketCrate"
ALTER COLUMN "ends_at" SET NOT NULL;

ALTER TABLE "BlackMarketCrate"
ADD COLUMN "requires_key" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "BlackMarketKeyInventory" (
  "account_id" TEXT NOT NULL,
  "crate_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BlackMarketKeyInventory_pkey" PRIMARY KEY ("account_id", "crate_id")
);

CREATE INDEX "BlackMarketKeyInventory_crate_id_quantity_idx"
ON "BlackMarketKeyInventory"("crate_id", "quantity");

ALTER TABLE "BlackMarketKeyInventory"
ADD CONSTRAINT "BlackMarketKeyInventory_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "WebAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackMarketKeyInventory"
ADD CONSTRAINT "BlackMarketKeyInventory_crate_id_fkey"
FOREIGN KEY ("crate_id") REFERENCES "BlackMarketCrate"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackMarketItem"
ADD COLUMN "expiry" "BlackMarketItemExpiry" NOT NULL DEFAULT 'permanent';

ALTER TABLE "BlackMarketInventory"
ADD COLUMN "expires_at" TIMESTAMP(3);

CREATE INDEX "BlackMarketInventory_account_id_expires_at_idx"
ON "BlackMarketInventory"("account_id", "expires_at");

ALTER TABLE "ShopProduct"
ADD COLUMN "product_type" "ShopProductType" NOT NULL DEFAULT 'standard',
ADD COLUMN "black_market_crate_id" TEXT;

CREATE INDEX "ShopProduct_black_market_crate_id_product_type_idx"
ON "ShopProduct"("black_market_crate_id", "product_type");

ALTER TABLE "ShopProduct"
ADD CONSTRAINT "ShopProduct_black_market_crate_id_fkey"
FOREIGN KEY ("black_market_crate_id") REFERENCES "BlackMarketCrate"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
