CREATE TABLE "InterestingFact" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "category" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InterestingFact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InterestingFact_created_at_id_idx"
ON "InterestingFact"("created_at", "id");
