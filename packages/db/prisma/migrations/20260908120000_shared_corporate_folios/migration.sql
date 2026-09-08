-- Shared corporate folios are account-level ledgers, not reservation folios.
ALTER TABLE "Folio" ADD COLUMN "corporateAccountId" UUID;

ALTER TABLE "Folio"
  ADD CONSTRAINT "Folio_corporateAccountId_fkey"
  FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Folio_propertyId_corporateAccountId_type_idx"
  ON "Folio" ("propertyId", "corporateAccountId", "type");
