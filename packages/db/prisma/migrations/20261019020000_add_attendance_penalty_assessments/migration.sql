CREATE TABLE "AttendancePenaltyAssessment" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "policyId" UUID NOT NULL,
    "attendanceRecordId" UUID,
    "payrollPeriodId" UUID,
    "eventDate" DATE NOT NULL,
    "trigger" TEXT NOT NULL,
    "minutes" INTEGER NOT NULL DEFAULT 0,
    "assessedAmount" DECIMAL(18,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "rejectionReason" TEXT,
    "appealStatus" TEXT,
    "appealReason" TEXT,
    "appealedAt" TIMESTAMPTZ,
    "appealReviewedById" UUID,
    "appealReviewedAt" TIMESTAMPTZ,
    "createdById" UUID NOT NULL,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ,
    "appliedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendancePenaltyAssessment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendancePenaltyAssessment_staffId_policyId_eventDate_key" ON "AttendancePenaltyAssessment"("staffId", "policyId", "eventDate");
CREATE INDEX "AttendancePenaltyAssessment_propertyId_status_eventDate_idx" ON "AttendancePenaltyAssessment"("propertyId", "status", "eventDate");
CREATE INDEX "AttendancePenaltyAssessment_staffId_eventDate_idx" ON "AttendancePenaltyAssessment"("staffId", "eventDate");
CREATE INDEX "AttendancePenaltyAssessment_payrollPeriodId_idx" ON "AttendancePenaltyAssessment"("payrollPeriodId");

ALTER TABLE "AttendancePenaltyAssessment" ADD CONSTRAINT "AttendancePenaltyAssessment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePenaltyAssessment" ADD CONSTRAINT "AttendancePenaltyAssessment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePenaltyAssessment" ADD CONSTRAINT "AttendancePenaltyAssessment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePenaltyAssessment" ADD CONSTRAINT "AttendancePenaltyAssessment_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "AttendancePenaltyPolicy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendancePenaltyAssessment" ADD CONSTRAINT "AttendancePenaltyAssessment_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendancePenaltyAssessment" ADD CONSTRAINT "AttendancePenaltyAssessment_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;
