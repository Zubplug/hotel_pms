ALTER TABLE "CorporateContract"
  ADD COLUMN "isPropertyDefault" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "defaultPropertyId" UUID;

ALTER TABLE "CorporateContract"
  DROP CONSTRAINT IF EXISTS "CorporateContract_exactly_one_identity_ck";

ALTER TABLE "CorporateContract"
  ADD CONSTRAINT "CorporateContract_identity_ck" CHECK (
    (("corporateAccountId" IS NOT NULL)::int + ("corporateBookingApplicationId" IS NOT NULL)::int + ("isPropertyDefault" AND "defaultPropertyId" IS NOT NULL)::int) = 1
  );

ALTER TABLE "CorporateContract"
  ADD CONSTRAINT "CorporateContract_defaultPropertyId_fkey"
  FOREIGN KEY ("defaultPropertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "CorporateContract_defaultPropertyId_key"
  ON "CorporateContract"("defaultPropertyId")
  WHERE "defaultPropertyId" IS NOT NULL;

CREATE INDEX "CorporateContract_defaultPropertyId_status_effectiveFrom_effectiveTo_idx"
  ON "CorporateContract"("defaultPropertyId", "status", "effectiveFrom", "effectiveTo");
