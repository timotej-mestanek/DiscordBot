CREATE TYPE "ItemGroup_new" AS ENUM ('emote', 'chat', 'overlay');

ALTER TABLE "BlackMarketItem"
ALTER COLUMN "group" DROP DEFAULT;

ALTER TABLE "BlackMarketItem"
ALTER COLUMN "group" TYPE "ItemGroup_new"
USING (
  CASE "group"::text
    WHEN 'emote_chat' THEN 'chat'
    ELSE "group"::text
  END
)::"ItemGroup_new";

DROP TYPE "ItemGroup";

ALTER TYPE "ItemGroup_new" RENAME TO "ItemGroup";

ALTER TABLE "BlackMarketItem"
ALTER COLUMN "group" SET DEFAULT 'chat';
