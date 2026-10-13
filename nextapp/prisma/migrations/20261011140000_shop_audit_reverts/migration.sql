ALTER TABLE "AdminAuditLog"
ADD COLUMN "reverted_log_id" TEXT;

CREATE UNIQUE INDEX "AdminAuditLog_reverted_log_id_key"
ON "AdminAuditLog"("reverted_log_id");
