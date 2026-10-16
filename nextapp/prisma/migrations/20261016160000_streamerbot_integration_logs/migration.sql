CREATE TABLE "StreamerBotIntegrationLog" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "operation" TEXT,
    "success" BOOLEAN NOT NULL,
    "status_code" INTEGER NOT NULL,
    "request_details" TEXT,
    "response_details" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamerBotIntegrationLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StreamerBotIntegrationLog_request_id_key"
ON "StreamerBotIntegrationLog"("request_id");
CREATE INDEX "StreamerBotIntegrationLog_created_at_id_idx"
ON "StreamerBotIntegrationLog"("created_at", "id");
CREATE INDEX "StreamerBotIntegrationLog_success_created_at_idx"
ON "StreamerBotIntegrationLog"("success", "created_at");
