ALTER TABLE "RefundRequest"
ADD COLUMN IF NOT EXISTS "cityLedgerEntryId" UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RefundRequest_cityLedgerEntryId_fkey'
  ) THEN
    ALTER TABLE "RefundRequest"
      ADD CONSTRAINT "RefundRequest_cityLedgerEntryId_fkey"
      FOREIGN KEY ("cityLedgerEntryId") REFERENCES "CityLedgerEntry"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "RefundRequest_cityLedgerEntryId_status_idx"
  ON "RefundRequest" ("cityLedgerEntryId", "status");
