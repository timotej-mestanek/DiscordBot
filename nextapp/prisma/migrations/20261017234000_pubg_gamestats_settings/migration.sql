ALTER TABLE "StreamOverlayIntegration"
ADD COLUMN "pubg_player_name" TEXT NOT NULL DEFAULT 'N4JTIK',
ADD COLUMN "pubg_teammates" JSONB NOT NULL DEFAULT '[]';
