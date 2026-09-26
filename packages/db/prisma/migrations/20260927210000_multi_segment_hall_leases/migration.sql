CREATE TABLE "LeaseContractSegment" (
  "id" UUID NOT NULL,
  "leaseContractId" UUID NOT NULL,
  "hallId" UUID NOT NULL,
  "usageDays" JSONB NOT NULL,
  "startTime" TEXT NOT NULL,
  "endTime" TEXT NOT NULL,
  "rate" DECIMAL(18,4) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "LeaseContractSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LeaseBillingScheduleLine" (
  "id" UUID NOT NULL,
  "scheduleId" UUID NOT NULL,
  "segmentId" UUID NOT NULL,
  "usageCount" INTEGER NOT NULL DEFAULT 0,
  "amount" DECIMAL(18,4) NOT NULL,
  CONSTRAINT "LeaseBillingScheduleLine_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "LeaseContractSegment"
  ADD CONSTRAINT "LeaseContractSegment_leaseContractId_fkey"
  FOREIGN KEY ("leaseContractId") REFERENCES "LeaseContract"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeaseContractSegment_hallId_fkey"
  FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaseBillingScheduleLine"
  ADD CONSTRAINT "LeaseBillingScheduleLine_scheduleId_fkey"
  FOREIGN KEY ("scheduleId") REFERENCES "LeaseBillingSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "LeaseBillingScheduleLine_segmentId_fkey"
  FOREIGN KEY ("segmentId") REFERENCES "LeaseContractSegment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "LeaseContractSegment_leaseContractId_idx" ON "LeaseContractSegment"("leaseContractId");
CREATE INDEX "LeaseContractSegment_hallId_startTime_endTime_idx" ON "LeaseContractSegment"("hallId", "startTime", "endTime");
CREATE UNIQUE INDEX "LeaseBillingScheduleLine_scheduleId_segmentId_key" ON "LeaseBillingScheduleLine"("scheduleId", "segmentId");
CREATE INDEX "LeaseBillingScheduleLine_segmentId_idx" ON "LeaseBillingScheduleLine"("segmentId");
