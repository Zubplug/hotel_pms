CREATE TABLE "OrganizationBillingDiscount" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "planId" UUID,
  "productId" UUID,
  "percentage" DECIMAL(5,2) NOT NULL,
  "reason" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "startsAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMPTZ,
  "createdByUserId" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OrganizationBillingDiscount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OrganizationBillingDiscount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationBillingDiscount_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationBillingDiscount_productId_fkey" FOREIGN KEY ("productId") REFERENCES "BillingProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "OrganizationBillingDiscount_organizationId_active_idx" ON "OrganizationBillingDiscount"("organizationId", "active");
CREATE INDEX "OrganizationBillingDiscount_organizationId_planId_idx" ON "OrganizationBillingDiscount"("organizationId", "planId");
CREATE INDEX "OrganizationBillingDiscount_organizationId_productId_idx" ON "OrganizationBillingDiscount"("organizationId", "productId");
