DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'isSuperAdmin')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'User' AND column_name = 'isLodgeCoreAdmin') THEN
    ALTER TABLE "User" RENAME COLUMN "isSuperAdmin" TO "isLodgeCoreAdmin";
  ELSE
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isLodgeCoreAdmin" BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "isSuperAdmin" BOOLEAN NOT NULL DEFAULT false;
UPDATE "User" SET "isSuperAdmin" = "isLodgeCoreAdmin" WHERE "isLodgeCoreAdmin" = true AND "isSuperAdmin" = false;

CREATE TABLE IF NOT EXISTS "BillingProduct" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "stripeProductId" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BillingProduct_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingProduct_code_key" ON "BillingProduct"("code");

CREATE TABLE IF NOT EXISTS "BillingPrice" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "productId" UUID NOT NULL,
  "stripePriceId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "currency" TEXT NOT NULL,
  "interval" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BillingPrice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingPrice_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingPrice_stripePriceId_key" ON "BillingPrice"("stripePriceId");
CREATE INDEX IF NOT EXISTS "BillingPrice_productId_idx" ON "BillingPrice"("productId");

CREATE TABLE IF NOT EXISTS "BillingCustomer" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BillingCustomer_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingCustomer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCustomer_organizationId_key" ON "BillingCustomer"("organizationId");
CREATE UNIQUE INDEX IF NOT EXISTS "BillingCustomer_stripeCustomerId_key" ON "BillingCustomer"("stripeCustomerId");

CREATE TABLE IF NOT EXISTS "Subscription" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "stripeSubscriptionId" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "currentPeriodStart" TIMESTAMPTZ NOT NULL,
  "currentPeriodEnd" TIMESTAMPTZ NOT NULL,
  "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
  "canceledAt" TIMESTAMPTZ,
  "trialEndsAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_stripeSubscriptionId_key" ON "Subscription"("stripeSubscriptionId");
CREATE INDEX IF NOT EXISTS "Subscription_organizationId_status_idx" ON "Subscription"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "SubscriptionItem" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "subscriptionId" UUID NOT NULL,
  "priceId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "SubscriptionItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SubscriptionItem_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SubscriptionItem_priceId_fkey" FOREIGN KEY ("priceId") REFERENCES "BillingPrice"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionItem_subscriptionId_priceId_key" ON "SubscriptionItem"("subscriptionId", "priceId");

CREATE TABLE IF NOT EXISTS "Entitlement" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "productCode" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "activatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "suspendedAt" TIMESTAMPTZ,
  "expiresAt" TIMESTAMPTZ,
  "suspensionReason" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "Entitlement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Entitlement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Entitlement_productCode_fkey" FOREIGN KEY ("productCode") REFERENCES "BillingProduct"("code") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "Entitlement_organizationId_productCode_key" ON "Entitlement"("organizationId", "productCode");
CREATE INDEX IF NOT EXISTS "Entitlement_organizationId_status_idx" ON "Entitlement"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "BillingEvent" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID,
  "stripeEventId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");

CREATE TABLE IF NOT EXISTS "BillingInvoice" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "organizationId" UUID NOT NULL,
  "stripeInvoiceId" TEXT NOT NULL,
  "stripeCustomerId" TEXT NOT NULL,
  "stripeSubscriptionId" TEXT,
  "status" TEXT NOT NULL,
  "currency" TEXT NOT NULL,
  "subtotal" INTEGER NOT NULL,
  "total" INTEGER NOT NULL,
  "amountPaid" INTEGER NOT NULL,
  "amountDue" INTEGER NOT NULL,
  "periodStart" TIMESTAMPTZ,
  "periodEnd" TIMESTAMPTZ,
  "hostedInvoiceUrl" TEXT,
  "invoicePdf" TEXT,
  "payload" JSONB NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BillingInvoice_stripeInvoiceId_key" UNIQUE ("stripeInvoiceId"),
  CONSTRAINT "BillingInvoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "BillingInvoice_organizationId_createdAt_idx" ON "BillingInvoice"("organizationId", "createdAt");
