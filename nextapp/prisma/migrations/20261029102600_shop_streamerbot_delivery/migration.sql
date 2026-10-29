ALTER TABLE "ShopProduct"
ADD COLUMN "streamerbot_action" TEXT NOT NULL DEFAULT 'shop.redeemed';

CREATE TABLE "ShopDeliveryEvent" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "action_key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShopDeliveryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShopDeliveryEvent_event_id_key"
ON "ShopDeliveryEvent"("event_id");

CREATE INDEX "ShopDeliveryEvent_delivered_at_cancelled_at_created_at_idx"
ON "ShopDeliveryEvent"("delivered_at", "cancelled_at", "created_at");

CREATE INDEX "ShopDeliveryEvent_product_id_created_at_idx"
ON "ShopDeliveryEvent"("product_id", "created_at");
