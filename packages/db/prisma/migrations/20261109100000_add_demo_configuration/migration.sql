CREATE TABLE "DemoConfiguration" (
    "id" UUID NOT NULL,
    "configKey" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" UUID,
    "propertyId" UUID,
    "grantorUserId" UUID,
    "updatedById" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "DemoConfiguration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DemoConfiguration_configKey_key" ON "DemoConfiguration"("configKey");
CREATE INDEX "DemoConfiguration_enabled_idx" ON "DemoConfiguration"("enabled");
