CREATE TABLE "ProfanityCategoryEvent" (
    "id" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "occurrence_count" INTEGER NOT NULL,
    "weighted_score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProfanityCategoryEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProfanityCategoryEvent_source_event_id_category_key"
ON "ProfanityCategoryEvent"("source_event_id", "category");

CREATE INDEX "ProfanityCategoryEvent_category_platform_provider_user_id_created_at_idx"
ON "ProfanityCategoryEvent"("category", "platform", "provider_user_id", "created_at");
