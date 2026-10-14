CREATE TABLE "EmployeeSeparationRequest" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reviewedById" UUID,
    "separationType" TEXT NOT NULL DEFAULT 'TERMINATED',
    "reason" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EmployeeSeparationRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeSeparationRequest_staffId_status_idx" ON "EmployeeSeparationRequest"("staffId", "status");
CREATE INDEX "EmployeeSeparationRequest_propertyId_status_createdAt_idx" ON "EmployeeSeparationRequest"("propertyId", "status", "createdAt");

ALTER TABLE "EmployeeSeparationRequest"
    ADD CONSTRAINT "EmployeeSeparationRequest_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeSeparationRequest"
    ADD CONSTRAINT "EmployeeSeparationRequest_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeSeparationRequest"
    ADD CONSTRAINT "EmployeeSeparationRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmployeeSeparationRequest"
    ADD CONSTRAINT "EmployeeSeparationRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
