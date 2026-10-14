ALTER TABLE "WorkShift"
    ADD CONSTRAINT "WorkShift_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShiftRoster"
    ADD COLUMN "publicationStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    ADD COLUMN "publishedAt" TIMESTAMPTZ,
    ADD COLUMN "publishedById" UUID,
    ADD COLUMN "cancelledAt" TIMESTAMPTZ,
    ADD COLUMN "cancelledById" UUID;

ALTER TABLE "ShiftRoster"
    ADD CONSTRAINT "ShiftRoster_publishedById_fkey"
    FOREIGN KEY ("publishedById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ShiftRoster"
    ADD CONSTRAINT "ShiftRoster_cancelledById_fkey"
    FOREIGN KEY ("cancelledById") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ShiftRoster_publicationStatus_propertyId_date_idx"
    ON "ShiftRoster"("publicationStatus", "propertyId", "date");
