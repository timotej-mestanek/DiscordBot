CREATE TABLE IF NOT EXISTS "ShopProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discord_price" INTEGER,
    "twitch_price" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopProduct_pkey" PRIMARY KEY ("id")
);

INSERT INTO "ShopProduct" (
    "id", "name", "description", "active", "updated_at"
)
VALUES (
    'custom-led-effect',
    'Custom LED effect',
    'Jedno použití editoru pro vytvoření vlastního LED efektu.',
    false,
    CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "ShopInventory" (
    "account_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ShopInventory_pkey" PRIMARY KEY ("account_id", "product_id")
);

CREATE INDEX IF NOT EXISTS "ShopInventory_product_id_quantity_idx"
ON "ShopInventory"("product_id", "quantity");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ShopInventory_account_id_fkey'
    ) THEN
        ALTER TABLE "ShopInventory"
        ADD CONSTRAINT "ShopInventory_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "WebAccount"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ShopInventory_product_id_fkey'
    ) THEN
        ALTER TABLE "ShopInventory"
        ADD CONSTRAINT "ShopInventory_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "ShopProduct"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS "ShopRedemption" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "effect" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShopRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ShopRedemption_account_id_created_at_idx"
ON "ShopRedemption"("account_id", "created_at");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ShopRedemption_account_id_fkey'
    ) THEN
        ALTER TABLE "ShopRedemption"
        ADD CONSTRAINT "ShopRedemption_account_id_fkey"
        FOREIGN KEY ("account_id") REFERENCES "WebAccount"("id")
        ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ShopRedemption_product_id_fkey'
    ) THEN
        ALTER TABLE "ShopRedemption"
        ADD CONSTRAINT "ShopRedemption_product_id_fkey"
        FOREIGN KEY ("product_id") REFERENCES "ShopProduct"("id")
        ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
