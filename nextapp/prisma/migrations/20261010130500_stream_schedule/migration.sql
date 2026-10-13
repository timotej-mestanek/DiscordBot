CREATE TABLE "StreamSettings" (
    "id" TEXT NOT NULL,
    "is_live" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamSettings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StreamSettings" ("id", "is_live", "updated_at")
VALUES ('stream', false, CURRENT_TIMESTAMP);

CREATE TABLE "StreamEvent" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StreamEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StreamEvent_starts_at_idx" ON "StreamEvent"("starts_at");
