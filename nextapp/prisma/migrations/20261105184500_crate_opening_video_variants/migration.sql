ALTER TABLE "BlackMarketCrate"
RENAME COLUMN "opening_video_url" TO "opening_video_normal_url";

ALTER TABLE "BlackMarketCrate"
ADD COLUMN "opening_video_gold_url" TEXT;
