ALTER TABLE "AuditEngagement" ADD COLUMN "risks" JSONB, ADD COLUMN "financialAreas" JSONB, ADD COLUMN "managementContacts" JSONB, ADD COLUMN "milestones" JSONB;
ALTER TABLE "AuditEvidenceRequest" ADD COLUMN "comments" JSONB, ADD COLUMN "attachments" JSONB;
ALTER TABLE "AuditWorkpaper" ADD COLUMN "expectedResult" TEXT, ADD COLUMN "actualResult" TEXT, ADD COLUMN "sampleSelection" TEXT, ADD COLUMN "reviewerNotes" JSONB, ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1, ADD COLUMN "lockedAt" TIMESTAMPTZ;
ALTER TABLE "AuditFinding" ADD COLUMN "controlArea" TEXT, ADD COLUMN "financialImpact" DECIMAL(18,4), ADD COLUMN "linkedTransactionIds" JSONB;
CREATE TYPE "AuditFinalPackStatus" AS ENUM ('DRAFT', 'PENDING_SIGNOFF', 'ISSUED', 'SUPERSEDED');
CREATE TABLE "AuditFinalPack" (
  "id" UUID NOT NULL,
  "engagementId" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "status" "AuditFinalPackStatus" NOT NULL DEFAULT 'DRAFT',
  "packageHash" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "reportManifest" JSONB,
  "auditorSignedAt" TIMESTAMPTZ,
  "managementSignedAt" TIMESTAMPTZ,
  "issuedAt" TIMESTAMPTZ,
  "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditFinalPack_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditFinalPack_packageHash_key" UNIQUE ("packageHash")
);
CREATE INDEX "AuditFinalPack_engagementId_status_idx" ON "AuditFinalPack"("engagementId", "status");
CREATE INDEX "AuditFinalPack_propertyId_createdAt_idx" ON "AuditFinalPack"("propertyId", "createdAt");
