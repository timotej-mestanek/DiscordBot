ALTER TABLE "WheelProfile"
ADD COLUMN "reset_at" TIMESTAMP(3);

UPDATE "WheelProfile" AS profile
SET "reset_at" = COALESCE(
  (
    SELECT MAX(spin.created_at)
    FROM "WheelSpin" AS spin
    WHERE spin.profile_id = profile.id
  ),
  CURRENT_TIMESTAMP
);
