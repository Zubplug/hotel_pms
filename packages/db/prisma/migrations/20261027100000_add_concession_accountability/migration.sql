ALTER TABLE "ComplimentaryRecord"
  ADD COLUMN "beneficiaryType" TEXT NOT NULL DEFAULT 'GUEST',
  ADD COLUMN "acknowledgedByStaffId" UUID,
  ADD COLUMN "acknowledgedAt" TIMESTAMPTZ;

ALTER TABLE "ComplimentaryRecord"
  ADD CONSTRAINT "ComplimentaryRecord_acknowledgedByStaffId_fkey"
  FOREIGN KEY ("acknowledgedByStaffId") REFERENCES "Staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ComplimentaryRecord_acknowledgedByStaffId_idx"
  ON "ComplimentaryRecord"("acknowledgedByStaffId");

ALTER TABLE "ApprovalRequest"
  ADD COLUMN "beneficiaryType" TEXT,
  ADD COLUMN "beneficiaryGuestId" UUID,
  ADD COLUMN "beneficiaryStaffId" UUID,
  ADD COLUMN "acknowledgedByStaffId" UUID,
  ADD COLUMN "acknowledgedAt" TIMESTAMPTZ;

ALTER TABLE "ApprovalRequest"
  ADD CONSTRAINT "ApprovalRequest_beneficiaryStaffId_fkey"
  FOREIGN KEY ("beneficiaryStaffId") REFERENCES "Staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "ApprovalRequest_acknowledgedByStaffId_fkey"
  FOREIGN KEY ("acknowledgedByStaffId") REFERENCES "Staff"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ApprovalRequest_beneficiaryStaffId_idx"
  ON "ApprovalRequest"("beneficiaryStaffId");

CREATE INDEX "ApprovalRequest_acknowledgedByStaffId_idx"
  ON "ApprovalRequest"("acknowledgedByStaffId");
