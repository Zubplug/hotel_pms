ALTER TABLE "BookingPaymentTransaction"
  ADD COLUMN "cityLedgerInvoiceId" UUID;

CREATE UNIQUE INDEX "BookingPaymentTransaction_cityLedgerInvoiceId_key"
  ON "BookingPaymentTransaction" ("cityLedgerInvoiceId")
  WHERE "cityLedgerInvoiceId" IS NOT NULL;

ALTER TABLE "BookingPaymentTransaction"
  ADD CONSTRAINT "BookingPaymentTransaction_cityLedgerInvoiceId_fkey"
  FOREIGN KEY ("cityLedgerInvoiceId") REFERENCES "CityLedgerInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
