ALTER TABLE "Property" ADD COLUMN "suspendedAt" TIMESTAMPTZ;
ALTER TABLE "Property" ADD COLUMN "suspensionReason" TEXT;
