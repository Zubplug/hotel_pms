CREATE TABLE "AttendancePenaltyPolicy" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 0,
    "maximumAmount" DECIMAL(18,4),
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttendancePenaltyPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AttendancePenaltyPolicy_propertyId_code_key" ON "AttendancePenaltyPolicy"("propertyId", "code");
CREATE INDEX "AttendancePenaltyPolicy_organizationId_propertyId_isActive_idx" ON "AttendancePenaltyPolicy"("organizationId", "propertyId", "isActive");
CREATE INDEX "AttendancePenaltyPolicy_propertyId_trigger_effectiveFrom_idx" ON "AttendancePenaltyPolicy"("propertyId", "trigger", "effectiveFrom");

ALTER TABLE "AttendancePenaltyPolicy" ADD CONSTRAINT "AttendancePenaltyPolicy_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AttendancePenaltyPolicy" ADD CONSTRAINT "AttendancePenaltyPolicy_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
