CREATE TABLE "StaffShiftPattern" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "shiftId" UUID NOT NULL,
    "onDays" INTEGER NOT NULL,
    "offDays" INTEGER NOT NULL,
    "anchorDate" DATE NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffShiftPattern_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffShiftPattern_staffId_key" ON "StaffShiftPattern"("staffId");
CREATE INDEX "StaffShiftPattern_propertyId_idx" ON "StaffShiftPattern"("propertyId");
CREATE INDEX "StaffShiftPattern_propertyId_anchorDate_idx" ON "StaffShiftPattern"("propertyId", "anchorDate");

ALTER TABLE "StaffShiftPattern" ADD CONSTRAINT "StaffShiftPattern_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffShiftPattern" ADD CONSTRAINT "StaffShiftPattern_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffShiftPattern" ADD CONSTRAINT "StaffShiftPattern_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
