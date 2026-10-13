CREATE TABLE "WebAccount" (
    "id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OAuthIdentity" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OAuthIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebSession" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthIdentity_provider_provider_user_id_key"
ON "OAuthIdentity"("provider", "provider_user_id");

CREATE UNIQUE INDEX "OAuthIdentity_account_id_provider_key"
ON "OAuthIdentity"("account_id", "provider");

CREATE INDEX "OAuthIdentity_account_id_idx"
ON "OAuthIdentity"("account_id");

CREATE UNIQUE INDEX "WebSession_token_hash_key"
ON "WebSession"("token_hash");

CREATE INDEX "WebSession_account_id_idx"
ON "WebSession"("account_id");

CREATE INDEX "WebSession_expires_at_idx"
ON "WebSession"("expires_at");

ALTER TABLE "OAuthIdentity"
ADD CONSTRAINT "OAuthIdentity_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "WebAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WebSession"
ADD CONSTRAINT "WebSession_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "WebAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
