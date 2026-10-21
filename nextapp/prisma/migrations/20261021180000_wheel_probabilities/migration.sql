WITH expanded_slices AS (
    SELECT
        profile."id" AS profile_id,
        slice_data.slice,
        slice_data.ordinality,
        (slice_data.slice ->> 'weight')::numeric AS old_weight,
        SUM((slice_data.slice ->> 'weight')::numeric) OVER (
            PARTITION BY profile."id"
        ) AS total_weight,
        COUNT(*) OVER (PARTITION BY profile."id") AS slice_count
    FROM "WheelProfile" AS profile
    CROSS JOIN LATERAL jsonb_array_elements(profile."config" -> 'slices')
        WITH ORDINALITY AS slice_data(slice, ordinality)
    WHERE jsonb_typeof(profile."config" -> 'slices') = 'array'
      AND jsonb_typeof(slice_data.slice -> 'weight') = 'number'
),
allocated_slices AS (
    SELECT
        profile_id,
        slice,
        ordinality,
        slice_count,
        CASE
            WHEN ordinality < slice_count THEN
                1 + FLOOR(
                    old_weight / total_weight * (10000 - slice_count)
                )
            ELSE NULL
        END AS allocated_points
    FROM expanded_slices
    WHERE total_weight > 0
),
normalized_slices AS (
    SELECT
        profile_id,
        slice,
        ordinality,
        CASE
            WHEN ordinality = slice_count THEN
                10000 - COALESCE(
                    SUM(allocated_points) OVER (
                        PARTITION BY profile_id
                        ORDER BY ordinality
                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
                    ),
                    0
                )
            ELSE allocated_points
        END AS probability_points
    FROM allocated_slices
),
normalized_configs AS (
    SELECT
        profile_id,
        jsonb_agg(
            (slice - 'weight') ||
                jsonb_build_object('probability', probability_points::numeric / 100)
            ORDER BY ordinality
        ) AS slices
    FROM normalized_slices
    GROUP BY profile_id
)
UPDATE "WheelProfile" AS profile
SET "config" = jsonb_set(profile."config", '{slices}', normalized_configs.slices)
FROM normalized_configs
WHERE profile."id" = normalized_configs.profile_id;
