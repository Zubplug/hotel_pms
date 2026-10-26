CREATE TABLE "OrganizationApprovalRequest" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reviewedById" UUID,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "payload" JSONB NOT NULL,
    "reviewNotes" TEXT,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrganizationApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "OrganizationApprovalRequest_organizationId_status_idx" ON "OrganizationApprovalRequest"("organizationId", "status");
CREATE INDEX "OrganizationApprovalRequest_requestedById_status_idx" ON "OrganizationApprovalRequest"("requestedById", "status");

ALTER TABLE "OrganizationApprovalRequest" ADD CONSTRAINT "OrganizationApprovalRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationApprovalRequest" ADD CONSTRAINT "OrganizationApprovalRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OrganizationApprovalRequest" ADD CONSTRAINT "OrganizationApprovalRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
