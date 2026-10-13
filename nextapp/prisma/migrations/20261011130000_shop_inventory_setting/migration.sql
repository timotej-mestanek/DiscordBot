ALTER TABLE "ShopProduct"
ADD COLUMN IF NOT EXISTS "add_to_inventory" BOOLEAN NOT NULL DEFAULT false;

UPDATE "ShopProduct"
SET "add_to_inventory" = true
WHERE "id" = 'custom-led-effect';
