CREATE TYPE "AuditEngagementStatus" AS ENUM ('PLANNING', 'ACTIVE', 'FIELDWORK', 'REPORTING', 'CLOSED', 'ARCHIVED');
CREATE TYPE "AuditRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'SUBMITTED', 'RETURNED', 'ACCEPTED', 'CLOSED');
CREATE TYPE "AuditWorkpaperStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED');
CREATE TYPE "AuditFindingSeverity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
CREATE TYPE "AuditFindingStatus" AS ENUM ('OPEN', 'MANAGEMENT_RESPONSE', 'IN_REMEDIATION', 'PENDING_VALIDATION', 'CLOSED');

CREATE TABLE "AuditEngagement" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "leadAuditorId" UUID NOT NULL,
  "status" "AuditEngagementStatus" NOT NULL DEFAULT 'PLANNING',
  "name" TEXT NOT NULL,
  "auditType" TEXT NOT NULL,
  "objective" TEXT,
  "scope" TEXT,
  "exclusions" TEXT,
  "materiality" DECIMAL(18,4),
  "currency" TEXT,
  "auditPeriodStart" DATE NOT NULL,
  "auditPeriodEnd" DATE NOT NULL,
  "plannedStartAt" TIMESTAMPTZ,
  "plannedEndAt" TIMESTAMPTZ,
  "closedAt" TIMESTAMPTZ,
  "metadata" JSONB,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEngagement_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditEngagement_period_check" CHECK ("auditPeriodEnd" >= "auditPeriodStart")
);
CREATE INDEX "AuditEngagement_propertyId_status_idx" ON "AuditEngagement"("propertyId", "status");
CREATE INDEX "AuditEngagement_organizationId_auditPeriodStart_auditPeriodEnd_idx" ON "AuditEngagement"("organizationId", "auditPeriodStart", "auditPeriodEnd");

CREATE TABLE "AuditEvidenceRequest" (
  "id" UUID NOT NULL,
  "engagementId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "status" "AuditRequestStatus" NOT NULL DEFAULT 'OPEN',
  "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
  "ownerId" UUID,
  "requesterId" UUID NOT NULL,
  "dueDate" DATE,
  "submittedAt" TIMESTAMPTZ,
  "acceptedAt" TIMESTAMPTZ,
  "responseNote" TEXT,
  "evidence" JSONB,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvidenceRequest_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditEvidenceRequest_engagementId_status_idx" ON "AuditEvidenceRequest"("engagementId", "status");
CREATE INDEX "AuditEvidenceRequest_propertyId_dueDate_idx" ON "AuditEvidenceRequest"("propertyId", "dueDate");

CREATE TABLE "AuditWorkpaper" (
  "id" UUID NOT NULL,
  "engagementId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "controlArea" TEXT NOT NULL,
  "objective" TEXT,
  "procedure" TEXT,
  "population" TEXT,
  "sampleSize" INTEGER,
  "result" TEXT,
  "status" "AuditWorkpaperStatus" NOT NULL DEFAULT 'DRAFT',
  "preparedById" UUID NOT NULL,
  "reviewedById" UUID,
  "evidenceIds" JSONB,
  "reviewerNote" TEXT,
  "signedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditWorkpaper_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditWorkpaper_engagementId_reference_key" UNIQUE ("engagementId", "reference")
);
CREATE INDEX "AuditWorkpaper_engagementId_status_idx" ON "AuditWorkpaper"("engagementId", "status");

CREATE TABLE "AuditFinding" (
  "id" UUID NOT NULL,
  "engagementId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "reference" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "criteria" TEXT,
  "condition" TEXT,
  "rootCause" TEXT,
  "riskImpact" TEXT,
  "recommendation" TEXT,
  "severity" "AuditFindingSeverity" NOT NULL DEFAULT 'MEDIUM',
  "status" "AuditFindingStatus" NOT NULL DEFAULT 'OPEN',
  "ownerId" UUID,
  "dueDate" DATE,
  "managementResponse" TEXT,
  "evidenceIds" JSONB,
  "createdById" UUID NOT NULL,
  "validatedById" UUID,
  "closedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditFinding_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditFinding_engagementId_reference_key" UNIQUE ("engagementId", "reference")
);
CREATE INDEX "AuditFinding_engagementId_status_severity_idx" ON "AuditFinding"("engagementId", "status", "severity");
CREATE INDEX "AuditFinding_propertyId_dueDate_idx" ON "AuditFinding"("propertyId", "dueDate");

CREATE TABLE "AuditActionPlan" (
  "id" UUID NOT NULL,
  "findingId" UUID NOT NULL,
  "engagementId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "ownerId" UUID NOT NULL,
  "dueDate" DATE NOT NULL,
  "status" "AuditFindingStatus" NOT NULL DEFAULT 'IN_REMEDIATION',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "completionNote" TEXT,
  "completedAt" TIMESTAMPTZ,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditActionPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditActionPlan_progress_check" CHECK ("progress" >= 0 AND "progress" <= 100)
);
CREATE INDEX "AuditActionPlan_engagementId_status_idx" ON "AuditActionPlan"("engagementId", "status");
CREATE INDEX "AuditActionPlan_propertyId_dueDate_idx" ON "AuditActionPlan"("propertyId", "dueDate");
