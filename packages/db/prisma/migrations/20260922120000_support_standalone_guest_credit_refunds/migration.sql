-- Standalone guest-credit liabilities do not belong to a reservation folio or
-- original payment. Refund requests and settlements may therefore reference
-- only the CityLedgerEntry.
ALTER TABLE "RefundRequest"
  ALTER COLUMN "folioId" DROP NOT NULL,
  ALTER COLUMN "paymentId" DROP NOT NULL;

ALTER TABLE "Refund"
  ALTER COLUMN "folioId" DROP NOT NULL,
  ALTER COLUMN "paymentId" DROP NOT NULL;
