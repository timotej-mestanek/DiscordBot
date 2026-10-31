CREATE TABLE "StreamerBotTwitchFollowEvent" (
  "id" TEXT NOT NULL,
  "source_event_id" TEXT NOT NULL,
  "twitch_user_id" TEXT NOT NULL,
  "display_name" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StreamerBotTwitchFollowEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamerBotTwitchFollowEvent_source_event_id_key"
ON "StreamerBotTwitchFollowEvent"("source_event_id");

CREATE INDEX "StreamerBotTwitchFollowEvent_twitch_user_id_created_at_idx"
ON "StreamerBotTwitchFollowEvent"("twitch_user_id", "created_at");
