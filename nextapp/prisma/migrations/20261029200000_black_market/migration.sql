ALTER TABLE "WebAccount"
ADD COLUMN "golden_eggs" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "BlackMarketCrate" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "starts_at" TIMESTAMP(3),
  "ends_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlackMarketCrate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlackMarketItem" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "group" TEXT NOT NULL DEFAULT 'chat',
  "max_level" INTEGER NOT NULL DEFAULT 6,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlackMarketItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlackMarketItemLevel" (
  "id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "level" INTEGER NOT NULL,
  "upgrade_cost" INTEGER,
  "image_url" TEXT NOT NULL,
  CONSTRAINT "BlackMarketItemLevel_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BlackMarketCrateItem" (
  "crate_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "weight" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "BlackMarketCrateItem_pkey" PRIMARY KEY ("crate_id", "item_id")
);

CREATE TABLE "BlackMarketCrateInventory" (
  "account_id" TEXT NOT NULL,
  "crate_id" TEXT NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "BlackMarketCrateInventory_pkey" PRIMARY KEY ("account_id", "crate_id")
);

CREATE TABLE "BlackMarketInventory" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "item_id" TEXT NOT NULL,
  "group" TEXT NOT NULL,
  "current_level" INTEGER NOT NULL DEFAULT 1,
  "is_equipped" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlackMarketInventory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlackMarketItemLevel_item_id_level_key"
ON "BlackMarketItemLevel"("item_id", "level");

CREATE UNIQUE INDEX "BlackMarketInventory_account_id_item_id_key"
ON "BlackMarketInventory"("account_id", "item_id");

CREATE INDEX "BlackMarketInventory_account_id_idx"
ON "BlackMarketInventory"("account_id");

CREATE INDEX "BlackMarketInventory_account_id_is_equipped_idx"
ON "BlackMarketInventory"("account_id", "is_equipped");

CREATE UNIQUE INDEX "black_market_inventory_one_equipped_per_group"
ON "BlackMarketInventory"("account_id", "group")
WHERE "is_equipped" = true;

ALTER TABLE "BlackMarketItemLevel"
ADD CONSTRAINT "BlackMarketItemLevel_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "BlackMarketItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackMarketCrateItem"
ADD CONSTRAINT "BlackMarketCrateItem_crate_id_fkey"
FOREIGN KEY ("crate_id") REFERENCES "BlackMarketCrate"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackMarketCrateItem"
ADD CONSTRAINT "BlackMarketCrateItem_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "BlackMarketItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackMarketCrateInventory"
ADD CONSTRAINT "BlackMarketCrateInventory_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "WebAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackMarketCrateInventory"
ADD CONSTRAINT "BlackMarketCrateInventory_crate_id_fkey"
FOREIGN KEY ("crate_id") REFERENCES "BlackMarketCrate"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackMarketInventory"
ADD CONSTRAINT "BlackMarketInventory_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "WebAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BlackMarketInventory"
ADD CONSTRAINT "BlackMarketInventory_item_id_fkey"
FOREIGN KEY ("item_id") REFERENCES "BlackMarketItem"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
