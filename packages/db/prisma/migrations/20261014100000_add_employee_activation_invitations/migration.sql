CREATE TABLE "EmployeeInvitation" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "acceptedAt" TIMESTAMPTZ,
    "invitedById" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EmployeeInvitation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmployeeInvitation_tokenHash_key" ON "EmployeeInvitation"("tokenHash");
CREATE INDEX "EmployeeInvitation_staffId_idx" ON "EmployeeInvitation"("staffId");
CREATE INDEX "EmployeeInvitation_userId_idx" ON "EmployeeInvitation"("userId");
CREATE INDEX "EmployeeInvitation_organizationId_expiresAt_acceptedAt_idx"
    ON "EmployeeInvitation"("organizationId", "expiresAt", "acceptedAt");

ALTER TABLE "EmployeeInvitation"
    ADD CONSTRAINT "EmployeeInvitation_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeInvitation"
    ADD CONSTRAINT "EmployeeInvitation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeInvitation"
    ADD CONSTRAINT "EmployeeInvitation_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmployeeInvitation"
    ADD CONSTRAINT "EmployeeInvitation_invitedById_fkey"
    FOREIGN KEY ("invitedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
