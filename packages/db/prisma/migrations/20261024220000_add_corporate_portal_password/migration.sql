ALTER TABLE "CorporatePortalIdentity"
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "passwordSetAt" TIMESTAMPTZ;
