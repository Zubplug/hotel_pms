ALTER TABLE "CityLedgerInvoice" ADD COLUMN "eventInvoiceId" UUID;

CREATE UNIQUE INDEX "CityLedgerInvoice_eventInvoiceId_key"
ON "CityLedgerInvoice"("eventInvoiceId");

ALTER TABLE "CityLedgerInvoice"
  ADD CONSTRAINT "CityLedgerInvoice_eventInvoiceId_fkey"
  FOREIGN KEY ("eventInvoiceId") REFERENCES "EventInvoice"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
