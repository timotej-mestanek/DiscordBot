CREATE TABLE "WheelProfile" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "game_id" TEXT,
    "game_name" TEXT,
    "config" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WheelProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WheelSpin" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "viewer_id" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "profile_id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "game_name" TEXT,
    "sequence" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WheelSpin_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "WheelProfile_game_id_key" ON "WheelProfile"("game_id");
CREATE UNIQUE INDEX "WheelSpin_event_id_key" ON "WheelSpin"("event_id");
CREATE INDEX "WheelSpin_created_at_id_idx" ON "WheelSpin"("created_at", "id");
CREATE INDEX "WheelSpin_profile_id_created_at_idx" ON "WheelSpin"("profile_id", "created_at");

INSERT INTO "WheelProfile" ("id", "kind", "config", "updated_at")
VALUES
    ('main', 'main', '{"title":"Koleso šťastia","enabled":false,"durationMs":8000,"slices":[]}'::jsonb, CURRENT_TIMESTAMP),
    ('vip', 'vip', '{"title":"VIP koleso šťastia","enabled":false,"durationMs":8000,"slices":[]}'::jsonb, CURRENT_TIMESTAMP);
