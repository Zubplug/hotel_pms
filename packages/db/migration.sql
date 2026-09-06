-- CreateEnum
CREATE TYPE "RevenueCategory" AS ENUM ('ROOM', 'FNB', 'OTHER', 'TAX');

-- CreateEnum
CREATE TYPE "HotelActivityCategory" AS ENUM ('FRONT_DESK', 'FINANCIAL', 'POS', 'NIGHT_AUDIT', 'SECURITY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "HotelActivitySeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');

-- AlterTable
ALTER TABLE "FolioItem" ADD COLUMN     "revenueCategory" "RevenueCategory" NOT NULL DEFAULT 'OTHER';

-- CreateTable
CREATE TABLE "NightAuditFinancialSnapshot" (
    "id" UUID NOT NULL,
    "nightAuditId" UUID NOT NULL,
    "roomRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "fnbRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "taxes" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "discounts" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "refunds" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "grossRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "netRevenue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NightAuditFinancialSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HotelActivityEvent" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "category" "HotelActivityCategory" NOT NULL,
    "eventType" TEXT NOT NULL,
    "actorId" UUID,
    "actorName" TEXT,
    "entityType" TEXT,
    "entityId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "amount" DECIMAL(18,4),
    "currency" TEXT,
    "severity" "HotelActivitySeverity" NOT NULL DEFAULT 'INFO',
    "metadata" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelActivityEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NightAuditFinancialSnapshot_nightAuditId_key" ON "NightAuditFinancialSnapshot"("nightAuditId");

-- CreateIndex
CREATE INDEX "HotelActivityEvent_propertyId_businessDate_idx" ON "HotelActivityEvent"("propertyId", "businessDate");

-- CreateIndex
CREATE INDEX "HotelActivityEvent_propertyId_category_idx" ON "HotelActivityEvent"("propertyId", "category");

-- AddForeignKey
ALTER TABLE "NightAuditFinancialSnapshot" ADD CONSTRAINT "NightAuditFinancialSnapshot_nightAuditId_fkey" FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HotelActivityEvent" ADD CONSTRAINT "HotelActivityEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

