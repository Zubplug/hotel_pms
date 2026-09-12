CREATE TABLE "CityLedgerInvoice" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CityLedgerInvoice_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CityLedgerEntry" ADD COLUMN "invoiceId" UUID;

CREATE UNIQUE INDEX "CityLedgerInvoice_propertyId_invoiceNumber_key" ON "CityLedgerInvoice"("propertyId", "invoiceNumber");
CREATE INDEX "CityLedgerInvoice_propertyId_dueDate_idx" ON "CityLedgerInvoice"("propertyId", "dueDate");
CREATE INDEX "CityLedgerInvoice_accountId_status_idx" ON "CityLedgerInvoice"("accountId", "status");
CREATE INDEX "CityLedgerEntry_invoiceId_idx" ON "CityLedgerEntry"("invoiceId");

ALTER TABLE "CityLedgerInvoice" ADD CONSTRAINT "CityLedgerInvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CityLedgerInvoice" ADD CONSTRAINT "CityLedgerInvoice_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "CityLedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CityLedgerEntry" ADD CONSTRAINT "CityLedgerEntry_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "CityLedgerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
