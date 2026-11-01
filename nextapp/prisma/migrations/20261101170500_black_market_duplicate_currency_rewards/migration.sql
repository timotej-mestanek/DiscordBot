ALTER TABLE "BlackMarketCrateItem"
ADD COLUMN "id" TEXT;

UPDATE "BlackMarketCrateItem"
SET "id" = 'crate-entry-' || md5("crate_id" || ':' || "item_id");

ALTER TABLE "BlackMarketCrateItem"
ALTER COLUMN "id" SET NOT NULL,
DROP CONSTRAINT "BlackMarketCrateItem_pkey",
ADD CONSTRAINT "BlackMarketCrateItem_pkey" PRIMARY KEY ("id");

CREATE INDEX "BlackMarketCrateItem_crate_id_item_id_idx"
ON "BlackMarketCrateItem" ("crate_id", "item_id");

CREATE UNIQUE INDEX "BlackMarketCrateItem_crate_id_golden_eggs_key"
ON "BlackMarketCrateItem" ("crate_id", "golden_eggs")
WHERE "golden_eggs" IS NOT NULL;
