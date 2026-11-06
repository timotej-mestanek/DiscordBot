ALTER TABLE "BlackMarketItem"
ADD COLUMN "use_input_label" TEXT;

ALTER TABLE "BlackMarketItemLevel"
ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

ALTER TABLE "BlackMarketInventory"
ADD COLUMN "use_input" TEXT;
