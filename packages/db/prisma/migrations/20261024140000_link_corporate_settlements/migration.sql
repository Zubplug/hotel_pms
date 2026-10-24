-- Phase 4A.2: durable one-to-one link for corporate gateway settlements.
--
-- This migration is intentionally unapplied. A nullable unique link allows
-- existing Booking Engine transactions to remain unchanged while ensuring a
-- CORPORATE_API transaction can point to at most one CityLedgerEntry.

ALTER TABLE "BookingPaymentTransaction"
  ADD COLUMN "cityLedgerEntryId" UUID;

CREATE UNIQUE INDEX "BookingPaymentTransaction_cityLedgerEntryId_key"
  ON "BookingPaymentTransaction"("cityLedgerEntryId");

ALTER TABLE "BookingPaymentTransaction"
  ADD CONSTRAINT "BookingPaymentTransaction_cityLedgerEntryId_fkey"
  FOREIGN KEY ("cityLedgerEntryId") REFERENCES "CityLedgerEntry"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
