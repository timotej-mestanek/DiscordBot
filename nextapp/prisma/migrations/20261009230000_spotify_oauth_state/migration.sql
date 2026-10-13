CREATE TABLE "SpotifyOAuthState" (
    "nonce" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpotifyOAuthState_pkey" PRIMARY KEY ("nonce")
);

CREATE INDEX "SpotifyOAuthState_expires_at_idx"
ON "SpotifyOAuthState"("expires_at");

ALTER TABLE "SpotifyOAuthState"
ADD CONSTRAINT "SpotifyOAuthState_account_id_fkey"
FOREIGN KEY ("account_id") REFERENCES "WebAccount"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
