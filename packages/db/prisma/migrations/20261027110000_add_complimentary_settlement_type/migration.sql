ALTER TABLE "ComplimentaryRecord"
  ADD COLUMN "settlementType" TEXT NOT NULL DEFAULT 'DUTY_MANAGER';

CREATE INDEX "ComplimentaryRecord_settlementType_idx"
  ON "ComplimentaryRecord"("settlementType");
