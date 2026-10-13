CREATE TABLE "Statistic" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Statistic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatisticEvent" (
    "id" SERIAL NOT NULL,
    "statistic_id" INTEGER NOT NULL,
    "entity_id" INTEGER NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StatisticEvent_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Statistic" ("id", "name") VALUES (1, 'points');
SELECT setval(pg_get_serial_sequence('"Statistic"', 'id'), 1, true);

CREATE INDEX "StatisticEvent_entity_id_idx" ON "StatisticEvent"("entity_id");
CREATE INDEX "StatisticEvent_statistic_id_idx" ON "StatisticEvent"("statistic_id");
CREATE INDEX "StatisticEvent_created_at_idx" ON "StatisticEvent"("created_at");

ALTER TABLE "StatisticEvent"
ADD CONSTRAINT "StatisticEvent_entity_id_fkey"
FOREIGN KEY ("entity_id") REFERENCES "Entity"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StatisticEvent"
ADD CONSTRAINT "StatisticEvent_statistic_id_fkey"
FOREIGN KEY ("statistic_id") REFERENCES "Statistic"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
