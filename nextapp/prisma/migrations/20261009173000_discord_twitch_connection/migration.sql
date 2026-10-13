CREATE TABLE "DiscordTwitchConnection" (
    "discord_id" TEXT NOT NULL,
    "twitch_id" TEXT,
    "twitch_name" TEXT,
    "linked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscordTwitchConnection_pkey" PRIMARY KEY ("discord_id")
);

CREATE UNIQUE INDEX "DiscordTwitchConnection_twitch_id_key"
ON "DiscordTwitchConnection"("twitch_id");
