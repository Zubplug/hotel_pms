-- CreateEnum
CREATE TYPE "FnbClass" AS ENUM ('FOOD', 'BEVERAGE', 'OTHER');

-- DropForeignKey
ALTER TABLE "AuditPack" DROP CONSTRAINT "AuditPack_nightAuditId_fkey";

-- DropForeignKey
ALTER TABLE "AuditPack" DROP CONSTRAINT "AuditPack_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "NightAuditClosePackage" DROP CONSTRAINT "NightAuditClosePackage_nightAuditId_fkey";

-- DropIndex
DROP INDEX "CityLedgerEntry_invoiceId_idx";

-- AlterTable
ALTER TABLE "JournalEntryLine" ADD COLUMN     "departmentId" UUID,
ADD COLUMN     "outletId" UUID;

-- AlterTable
ALTER TABLE "ProductCategory" ADD COLUMN     "fnbClass" "FnbClass" NOT NULL DEFAULT 'OTHER';

-- AlterTable
ALTER TABLE "Property" ALTER COLUMN "nightAuditHighBalanceThreshold" SET DEFAULT 1000000;

-- DropTable
DROP TABLE "AuditPack";

-- CreateTable
CREATE TABLE "Department" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Department_propertyId_name_key" ON "Department"("propertyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_propertyId_nightAuditId_key" ON "JournalEntry"("propertyId", "nightAuditId");

-- CreateIndex
CREATE UNIQUE INDEX "NightAuditFinancialSnapshot_snapshotHash_key" ON "NightAuditFinancialSnapshot"("snapshotHash");

-- AddForeignKey
ALTER TABLE "NightAuditClosePackage" ADD CONSTRAINT "NightAuditClosePackage_nightAuditId_fkey" FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "PosOutlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "NightAuditBalanceSnapshot_closePackageId_ledgerType_accountKey_" RENAME TO "NightAuditBalanceSnapshot_closePackageId_ledgerType_account_key";

-- RenameIndex
ALTER INDEX "NightAuditBalanceSnapshot_propertyId_businessDate_ledgerType_id" RENAME TO "NightAuditBalanceSnapshot_propertyId_businessDate_ledgerTyp_idx";

