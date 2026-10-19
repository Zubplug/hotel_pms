CREATE TABLE "CompensationChangeRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "currentBasicSalary" DECIMAL(18,4) NOT NULL,
    "currentHousingAllowance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currentTransportAllowance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currentOtherAllowances" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "proposedBasicSalary" DECIMAL(18,4) NOT NULL,
    "proposedHousingAllowance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "proposedTransportAllowance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "proposedOtherAllowances" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "effectiveDate" DATE NOT NULL,
    "increasePercentage" DECIMAL(9,4),
    "probationReviewDate" DATE,
    "reason" TEXT NOT NULL,
    "supportingDocumentUrl" TEXT,
    "payrollImpact" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "requestedById" UUID NOT NULL,
    "departmentReviewedById" UUID,
    "hrReviewedById" UUID,
    "approvedById" UUID,
    "departmentReviewedAt" TIMESTAMPTZ,
    "hrReviewedAt" TIMESTAMPTZ,
    "approvedAt" TIMESTAMPTZ,
    "appliedAt" TIMESTAMPTZ,
    "employeeAcknowledgedAt" TIMESTAMPTZ,
    "departmentReviewNotes" TEXT,
    "hrReviewNotes" TEXT,
    "approvalNotes" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompensationChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "CompensationChangeRequest_organizationId_propertyId_status_createdAt_idx" ON "CompensationChangeRequest"("organizationId", "propertyId", "status", "createdAt");
CREATE INDEX "CompensationChangeRequest_staffId_effectiveDate_idx" ON "CompensationChangeRequest"("staffId", "effectiveDate");

ALTER TABLE "CompensationChangeRequest" ADD CONSTRAINT "CompensationChangeRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensationChangeRequest" ADD CONSTRAINT "CompensationChangeRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensationChangeRequest" ADD CONSTRAINT "CompensationChangeRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompensationChangeRequest" ADD CONSTRAINT "CompensationChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CompensationChangeRequest" ADD CONSTRAINT "CompensationChangeRequest_departmentReviewedById_fkey" FOREIGN KEY ("departmentReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensationChangeRequest" ADD CONSTRAINT "CompensationChangeRequest_hrReviewedById_fkey" FOREIGN KEY ("hrReviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompensationChangeRequest" ADD CONSTRAINT "CompensationChangeRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
