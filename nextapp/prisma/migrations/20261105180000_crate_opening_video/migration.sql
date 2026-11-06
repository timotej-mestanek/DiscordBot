ALTER TABLE "BlackMarketCrate"
RENAME COLUMN "texture_url" TO "opening_video_url";

UPDATE "BlackMarketCrate"
SET "opening_video_url" = NULL;
