ALTER TABLE "Event"
  ADD COLUMN "guestId" UUID,
  ADD COLUMN "corporateAccountId" UUID;

ALTER TABLE "EventInvoice"
  ADD COLUMN "subTotal" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "totalDiscount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "totalTax" DECIMAL(18,4) NOT NULL DEFAULT 0;

ALTER TABLE "EventInvoiceItem"
  ADD COLUMN "grossAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "discountAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
  ADD COLUMN "taxId" UUID,
  ADD COLUMN "discountId" UUID;

ALTER TABLE "Payment"
  ADD COLUMN "eventInvoiceId" UUID;

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "Event_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EventInvoiceItem"
  ADD CONSTRAINT "EventInvoiceItem_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "EventInvoiceItem_discountId_fkey" FOREIGN KEY ("discountId") REFERENCES "Discount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment"
  ADD CONSTRAINT "Payment_eventInvoiceId_fkey" FOREIGN KEY ("eventInvoiceId") REFERENCES "EventInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Payment_eventInvoiceId_idx" ON "Payment"("eventInvoiceId");

ALTER TABLE "Event"
  ADD CONSTRAINT "Event_exactly_one_client_check"
  CHECK (num_nonnulls("guestId", "corporateAccountId") = 1);

CREATE UNIQUE INDEX "FolioItem_folioId_operationId_key"
ON "FolioItem"("folioId", "operationId");
