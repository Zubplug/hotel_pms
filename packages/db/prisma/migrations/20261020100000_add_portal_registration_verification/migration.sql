ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ;

UPDATE "User"
SET "emailVerifiedAt" = "createdAt"
WHERE "emailVerifiedAt" IS NULL;

CREATE TABLE "PortalEmailVerification" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "usedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortalEmailVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PortalEmailVerification_tokenHash_key"
  ON "PortalEmailVerification"("tokenHash");

CREATE INDEX "PortalEmailVerification_userId_expiresAt_usedAt_idx"
  ON "PortalEmailVerification"("userId", "expiresAt", "usedAt");

ALTER TABLE "PortalEmailVerification"
  ADD CONSTRAINT "PortalEmailVerification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
