CREATE TABLE "pos_activation_keys" (
    "id" UUID NOT NULL,
    "keyHash" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID,
    "outletId" UUID,
    "activatedTerminalId" UUID,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMPTZ,
    "createdBy" UUID,
    "activatedAt" TIMESTAMPTZ,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "pos_activation_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pos_activation_keys_keyHash_key" ON "pos_activation_keys"("keyHash");
CREATE UNIQUE INDEX "pos_activation_keys_activatedTerminalId_key" ON "pos_activation_keys"("activatedTerminalId");
CREATE INDEX "pos_activation_keys_organizationId_status_idx" ON "pos_activation_keys"("organizationId", "status");
CREATE INDEX "pos_activation_keys_propertyId_status_idx" ON "pos_activation_keys"("propertyId", "status");

ALTER TABLE "pos_activation_keys" ADD CONSTRAINT "pos_activation_keys_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_activation_keys" ADD CONSTRAINT "pos_activation_keys_propertyId_fkey"
  FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_activation_keys" ADD CONSTRAINT "pos_activation_keys_outletId_fkey"
  FOREIGN KEY ("outletId") REFERENCES "pos_outlets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "pos_activation_keys" ADD CONSTRAINT "pos_activation_keys_activatedTerminalId_fkey"
  FOREIGN KEY ("activatedTerminalId") REFERENCES "pos_terminals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
