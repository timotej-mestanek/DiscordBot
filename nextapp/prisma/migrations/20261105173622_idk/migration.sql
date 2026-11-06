/*
  Warnings:

  - You are about to drop the `StreamSettings` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropIndex
DROP INDEX "BlackMarketInventory_account_id_expires_at_idx";

-- DropTable
DROP TABLE "StreamSettings";

-- RenameIndex
ALTER INDEX "ProfanityCategoryEvent_category_platform_provider_user_id_creat" RENAME TO "ProfanityCategoryEvent_category_platform_provider_user_id_c_idx";

-- RenameIndex
ALTER INDEX "StreamerBotChatMetricEvent_platform_provider_user_id_created_at" RENAME TO "StreamerBotChatMetricEvent_platform_provider_user_id_create_idx";
