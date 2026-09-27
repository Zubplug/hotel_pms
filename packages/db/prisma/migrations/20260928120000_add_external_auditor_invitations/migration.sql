CREATE TABLE "ExternalAuditorInvitation" (
  "id" UUID NOT NULL,
  "email" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" UUID,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "acceptedAt" TIMESTAMPTZ,
  "invitedById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalAuditorInvitation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ExternalAuditorInvitation_tokenHash_key" UNIQUE ("tokenHash"),
  CONSTRAINT "ExternalAuditorInvitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ExternalAuditorInvitation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ExternalAuditorInvitation_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON UPDATE CASCADE
);
CREATE INDEX "ExternalAuditorInvitation_email_organizationId_idx" ON "ExternalAuditorInvitation"("email", "organizationId");
CREATE INDEX "ExternalAuditorInvitation_expiresAt_acceptedAt_idx" ON "ExternalAuditorInvitation"("expiresAt", "acceptedAt");
