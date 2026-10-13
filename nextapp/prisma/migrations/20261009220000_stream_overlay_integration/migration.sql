CREATE TABLE "StreamOverlayIntegration" (
    "id" TEXT NOT NULL,
    "spotify_rt" TEXT,
    "spotify_at" TEXT,
    "spotify_exp" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StreamOverlayIntegration_pkey" PRIMARY KEY ("id")
);

INSERT INTO "StreamOverlayIntegration" (
    "id",
    "spotify_rt",
    "spotify_at",
    "spotify_exp",
    "updated_at"
)
SELECT
    'streamer',
    "spotify_rt",
    "spotify_at",
    "spotify_exp",
    CURRENT_TIMESTAMP
FROM "User"
WHERE "id" = 1 AND "spotify_rt" IS NOT NULL
ON CONFLICT ("id") DO NOTHING;
