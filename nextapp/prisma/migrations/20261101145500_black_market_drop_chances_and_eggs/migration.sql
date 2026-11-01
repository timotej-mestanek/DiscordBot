ALTER TYPE "BlackMarketItemType" ADD VALUE 'golden_eggs';

ALTER TABLE "BlackMarketCrateItem"
ADD COLUMN "drop_chance" DECIMAL(5, 2) NOT NULL DEFAULT 0,
ADD COLUMN "golden_eggs" INTEGER;

WITH weighted AS (
  SELECT
    "crate_id",
    "item_id",
    "weight",
    SUM("weight") OVER (PARTITION BY "crate_id") AS "total_weight"
  FROM "BlackMarketCrateItem"
),
shares AS (
  SELECT
    "crate_id",
    "item_id",
    FLOOR("weight"::DECIMAL * 10000 / "total_weight")::INTEGER AS "base_chance",
    ("weight"::DECIMAL * 10000 / "total_weight")
      - FLOOR("weight"::DECIMAL * 10000 / "total_weight") AS "remainder"
  FROM weighted
),
ranked AS (
  SELECT
    "crate_id",
    "item_id",
    "base_chance",
    SUM("base_chance") OVER (PARTITION BY "crate_id") AS "allocated_base",
    ROW_NUMBER() OVER (
      PARTITION BY "crate_id"
      ORDER BY "remainder" DESC, "item_id" ASC
    ) AS "remainder_rank"
  FROM shares
),
allocated AS (
  SELECT
    "crate_id",
    "item_id",
    (
      "base_chance" +
      CASE
        WHEN "remainder_rank" <= 10000 - "allocated_base" THEN 1
        ELSE 0
      END
    )::DECIMAL / 100 AS "drop_chance"
  FROM ranked
)
UPDATE "BlackMarketCrateItem" AS entry
SET "drop_chance" = allocated."drop_chance"
FROM allocated
WHERE entry."crate_id" = allocated."crate_id"
  AND entry."item_id" = allocated."item_id";

ALTER TABLE "BlackMarketCrateItem"
DROP COLUMN "weight";

ALTER TABLE "BlackMarketCrateItem"
ADD CONSTRAINT "BlackMarketCrateItem_drop_chance_range"
CHECK ("drop_chance" >= 0 AND "drop_chance" <= 100),
ADD CONSTRAINT "BlackMarketCrateItem_golden_eggs_positive"
CHECK ("golden_eggs" IS NULL OR "golden_eggs" > 0);
