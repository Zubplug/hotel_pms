CREATE TABLE "CustomerInvitation" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "email" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" UUID,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "acceptedAt" TIMESTAMPTZ,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CustomerInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CustomerInvitation_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "CustomerInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CustomerInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CustomerInvitation_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON UPDATE CASCADE
);
CREATE INDEX "CustomerInvitation_email_organizationId_idx" ON "CustomerInvitation"("email", "organizationId");
CREATE INDEX "CustomerInvitation_expiresAt_acceptedAt_idx" ON "CustomerInvitation"("expiresAt", "acceptedAt");
