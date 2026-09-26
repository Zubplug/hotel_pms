ALTER TABLE "LeaseContract"
  ADD COLUMN "corporateAccountId" UUID,
  ADD COLUMN "eventId" UUID,
  ADD COLUMN "usageFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
  ADD COLUMN "billingDates" JSONB,
  ADD COLUMN "usageDays" JSONB,
  ADD COLUMN "startTime" TEXT,
  ADD COLUMN "endTime" TEXT,
  ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN',
  ADD COLUMN "createdBy" UUID;

ALTER TABLE "LeaseBillingSchedule"
  ADD COLUMN "periodStart" DATE,
  ADD COLUMN "periodEnd" DATE,
  ADD COLUMN "usageCount" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "EventInvoice" ADD COLUMN "propertyId" UUID;

UPDATE "EventInvoice" ei
SET "propertyId" = e."propertyId"
FROM "Event" e
WHERE ei."eventId" = e."id" AND ei."propertyId" IS NULL;

UPDATE "LeaseBillingSchedule"
SET "periodStart" = "dueDate", "periodEnd" = "dueDate"
WHERE "periodStart" IS NULL OR "periodEnd" IS NULL;

UPDATE "LeaseContract" lc
SET "corporateAccountId" = ca.id
FROM "CorporateAccount" ca
WHERE ca."propertyId" = lc."propertyId"
  AND lower(ca.name) = lower(lc."contactName")
  AND lc."corporateAccountId" IS NULL;

ALTER TABLE "LeaseBillingSchedule" ALTER COLUMN "periodStart" SET NOT NULL;
ALTER TABLE "LeaseBillingSchedule" ALTER COLUMN "periodEnd" SET NOT NULL;

ALTER TABLE "LeaseContract"
  ADD CONSTRAINT "LeaseContract_corporateAccountId_fkey"
  FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "LeaseContract"
  ADD CONSTRAINT "LeaseContract_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventInvoice"
  ADD CONSTRAINT "EventInvoice_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "LeaseBillingSchedule"
  ADD CONSTRAINT "LeaseBillingSchedule_invoiceId_fkey"
  FOREIGN KEY ("invoiceId") REFERENCES "EventInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX "LeaseBillingSchedule_invoiceId_key" ON "LeaseBillingSchedule"("invoiceId");
CREATE UNIQUE INDEX "LeaseContract_eventId_key" ON "LeaseContract"("eventId");
CREATE UNIQUE INDEX "LeaseBillingSchedule_leaseContractId_periodStart_periodEnd_key"
ON "LeaseBillingSchedule"("leaseContractId", "periodStart", "periodEnd");
