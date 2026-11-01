CREATE UNIQUE INDEX "BlackMarketItem_single_golden_eggs_type"
ON "BlackMarketItem" ("item_type")
WHERE "item_type" = 'golden_eggs';
