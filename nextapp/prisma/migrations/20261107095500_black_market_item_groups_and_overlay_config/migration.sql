CREATE TYPE "ItemGroup" AS ENUM ('emote_chat', 'overlay');

ALTER TABLE "BlackMarketItem"
ADD COLUMN "overlay_config" JSONB,
ALTER COLUMN "group" DROP DEFAULT;

UPDATE "BlackMarketItem"
SET "group" = CASE
  WHEN "group" = 'overlay' THEN 'overlay'
  ELSE 'emote_chat'
END;

ALTER TABLE "BlackMarketItem"
ALTER COLUMN "group" TYPE "ItemGroup" USING ("group"::"ItemGroup"),
ALTER COLUMN "group" SET DEFAULT 'emote_chat';
