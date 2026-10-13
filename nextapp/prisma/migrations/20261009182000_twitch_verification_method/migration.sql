ALTER TABLE "DiscordTwitchConnection"
ADD COLUMN "verification_method" TEXT NOT NULL DEFAULT 'discord_connection';
