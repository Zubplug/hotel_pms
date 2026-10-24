ALTER TABLE "CorporateBookingApplication"
  ADD COLUMN "companyAddress" TEXT,
  ADD COLUMN "companyCity" TEXT,
  ADD COLUMN "companyCountry" TEXT;

ALTER TABLE "CorporateAccount"
  ADD COLUMN "companyAddress" TEXT,
  ADD COLUMN "companyCity" TEXT,
  ADD COLUMN "companyCountry" TEXT;
