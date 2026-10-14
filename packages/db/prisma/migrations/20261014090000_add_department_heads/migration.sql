ALTER TABLE "Department"
ADD COLUMN "headStaffId" UUID;

CREATE INDEX "Department_headStaffId_idx" ON "Department"("headStaffId");

ALTER TABLE "Department"
ADD CONSTRAINT "Department_headStaffId_fkey"
FOREIGN KEY ("headStaffId") REFERENCES "Staff"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
