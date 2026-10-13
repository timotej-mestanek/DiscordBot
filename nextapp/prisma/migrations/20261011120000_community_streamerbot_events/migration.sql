CREATE TABLE "StreamerBotChatMetricEvent" (
    "id" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "profanity_count" INTEGER NOT NULL DEFAULT 0,
    "message_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamerBotChatMetricEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GamblingEvent" (
    "id" TEXT NOT NULL,
    "source_event_id" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "provider_user_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "activity" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GamblingEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamerBotChatMetricEvent_source_event_id_key"
ON "StreamerBotChatMetricEvent"("source_event_id");
CREATE INDEX "StreamerBotChatMetricEvent_platform_provider_user_id_created_at_idx"
ON "StreamerBotChatMetricEvent"("platform", "provider_user_id", "created_at");

CREATE UNIQUE INDEX "GamblingEvent_source_event_id_key"
ON "GamblingEvent"("source_event_id");
CREATE INDEX "GamblingEvent_platform_provider_user_id_created_at_idx"
ON "GamblingEvent"("platform", "provider_user_id", "created_at");
