CREATE TABLE "DemoAccount" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "roleName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdIp" TEXT,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "expiredAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DemoAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoAccount_userId_key" ON "DemoAccount"("userId");
CREATE UNIQUE INDEX "DemoAccount_staffId_key" ON "DemoAccount"("staffId");
CREATE INDEX "DemoAccount_status_expiresAt_idx" ON "DemoAccount"("status", "expiresAt");
CREATE INDEX "DemoAccount_createdIp_createdAt_idx" ON "DemoAccount"("createdIp", "createdAt");
CREATE INDEX "DemoAccount_organizationId_propertyId_status_idx" ON "DemoAccount"("organizationId", "propertyId", "status");

ALTER TABLE "DemoAccount" ADD CONSTRAINT "DemoAccount_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemoAccount" ADD CONSTRAINT "DemoAccount_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemoAccount" ADD CONSTRAINT "DemoAccount_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DemoAccount" ADD CONSTRAINT "DemoAccount_staffId_fkey"
  FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
