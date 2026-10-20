-- Idempotent consolidation of the portal registration migrations:
-- 20261020100000_add_portal_registration_verification
-- 20261020110000_add_user_name_fields
-- 20261020120000_add_user_middle_name

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMPTZ;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "middleName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "lastName" TEXT;

UPDATE "User"
SET "emailVerifiedAt" = "createdAt"
WHERE "emailVerifiedAt" IS NULL;

CREATE TABLE IF NOT EXISTS "PortalEmailVerification" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalEmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortalEmailVerification_tokenHash_key"
  ON "PortalEmailVerification"("tokenHash");

CREATE INDEX IF NOT EXISTS "PortalEmailVerification_userId_expiresAt_usedAt_idx"
  ON "PortalEmailVerification"("userId", "expiresAt", "usedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PortalEmailVerification_userId_fkey'
      AND conrelid = '"PortalEmailVerification"'::regclass
  ) THEN
    ALTER TABLE "PortalEmailVerification"
      ADD CONSTRAINT "PortalEmailVerification_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
