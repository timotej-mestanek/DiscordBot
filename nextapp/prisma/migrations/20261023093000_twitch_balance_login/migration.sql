ALTER TABLE "TwitchCustomPointBalance"
ADD COLUMN "twitch_user_login" TEXT;

WITH known_logins AS (
    SELECT
        "details"->>'twitchUserId' AS twitch_user_id,
        lower("details"->>'twitchUserLogin') AS twitch_user_login,
        "created_at"
    FROM "AdminAuditLog"
    WHERE "action" = 'points.streamerbot.adjusted'
      AND "details"->>'currency' = 'twitch_custom'
      AND "details"->>'twitchUserLogin' ~ '^[A-Za-z0-9_]{1,25}$'

    UNION ALL

    SELECT
        "details"->>'toTwitchUserId' AS twitch_user_id,
        lower("details"->>'toTwitchUserLogin') AS twitch_user_login,
        "created_at"
    FROM "AdminAuditLog"
    WHERE "action" = 'points.streamerbot.transferred'
      AND "details"->>'currency' = 'twitch_custom'
      AND "details"->>'toTwitchUserLogin' ~ '^[A-Za-z0-9_]{1,25}$'
),
latest_logins AS (
    SELECT DISTINCT ON (twitch_user_id)
        twitch_user_id,
        twitch_user_login
    FROM known_logins
    ORDER BY twitch_user_id, "created_at" DESC
)
UPDATE "TwitchCustomPointBalance" AS balance
SET "twitch_user_login" = latest_logins.twitch_user_login
FROM latest_logins
WHERE balance."twitch_user_id" = latest_logins.twitch_user_id;
