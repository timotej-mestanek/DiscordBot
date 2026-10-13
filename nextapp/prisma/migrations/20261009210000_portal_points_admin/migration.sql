CREATE TYPE "WebRole" AS ENUM ('user', 'admin');
CREATE TYPE "PointCurrency" AS ENUM ('discord', 'twitch_custom');

ALTER TABLE "WebAccount"
ADD COLUMN "role" "WebRole" NOT NULL DEFAULT 'user';

CREATE TABLE "TwitchCustomPointBalance" (
    "twitch_user_id" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TwitchCustomPointBalance_pkey" PRIMARY KEY ("twitch_user_id")
);

CREATE TABLE "PointLedgerEntry" (
    "id" TEXT NOT NULL,
    "currency" "PointCurrency" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source_event_id" TEXT,
    "actor_account_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PointLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PointConversionRate" (
    "source_currency" "PointCurrency" NOT NULL,
    "target_currency" "PointCurrency" NOT NULL,
    "source_amount" INTEGER NOT NULL,
    "target_amount" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PointConversionRate_pkey" PRIMARY KEY ("source_currency", "target_currency")
);

CREATE TABLE "AdminAuditLog" (
    "id" TEXT NOT NULL,
    "actor_account_id" TEXT,
    "target_account_id" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PointLedgerEntry_source_event_id_key"
ON "PointLedgerEntry"("source_event_id");

CREATE INDEX "PointLedgerEntry_currency_provider_user_id_created_at_idx"
ON "PointLedgerEntry"("currency", "provider_user_id", "created_at");

CREATE INDEX "AdminAuditLog_created_at_idx"
ON "AdminAuditLog"("created_at");

CREATE INDEX "AdminAuditLog_target_account_id_created_at_idx"
ON "AdminAuditLog"("target_account_id", "created_at");

ALTER TABLE "PointLedgerEntry"
ADD CONSTRAINT "PointLedgerEntry_actor_account_id_fkey"
FOREIGN KEY ("actor_account_id") REFERENCES "WebAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAuditLog"
ADD CONSTRAINT "AdminAuditLog_actor_account_id_fkey"
FOREIGN KEY ("actor_account_id") REFERENCES "WebAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AdminAuditLog"
ADD CONSTRAINT "AdminAuditLog_target_account_id_fkey"
FOREIGN KEY ("target_account_id") REFERENCES "WebAccount"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
