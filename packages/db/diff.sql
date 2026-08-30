-- CreateEnum
CREATE TYPE "KitchenWasteStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED');

-- CreateEnum
CREATE TYPE "KitchenWasteReason" AS ENUM ('SPOILAGE', 'OVER_PRODUCTION', 'BURNED', 'DAMAGED', 'RETURNED', 'WRONG_ORDER', 'OTHER');

-- AlterEnum
BEGIN;
CREATE TYPE "HousekeepingStatus_new" AS ENUM ('PENDING', 'ASSIGNED', 'CLEANING', 'CLEAN', 'INSPECTED', 'CANCELLED', 'MAINTENANCE_REQUIRED');
ALTER TABLE "Room" ALTER COLUMN "housekeepingStatus" TYPE "HousekeepingStatus_new" USING ("housekeepingStatus"::text::"HousekeepingStatus_new");
ALTER TABLE "HousekeepingTask" ALTER COLUMN "status" TYPE "HousekeepingStatus_new" USING ("status"::text::"HousekeepingStatus_new");
ALTER TYPE "HousekeepingStatus" RENAME TO "HousekeepingStatus_old";
ALTER TYPE "HousekeepingStatus_new" RENAME TO "HousekeepingStatus";
DROP TYPE "HousekeepingStatus_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "BankDeposit" DROP CONSTRAINT "BankDeposit_bankAccountId_fkey";

-- DropForeignKey
ALTER TABLE "CashExpense" DROP CONSTRAINT "CashExpense_cashAccountId_fkey";

-- DropForeignKey
ALTER TABLE "CashExpense" DROP CONSTRAINT "CashExpense_categoryId_fkey";

-- DropForeignKey
ALTER TABLE "CashExpense" DROP CONSTRAINT "CashExpense_costCenterId_fkey";

-- DropForeignKey
ALTER TABLE "FolioItem" DROP CONSTRAINT "FolioItem_nightAuditRunId_fkey";

-- DropForeignKey
ALTER TABLE "FrontdeskSessionAudit" DROP CONSTRAINT "FrontdeskSessionAudit_frontdeskSessionId_fkey";

-- DropForeignKey
ALTER TABLE "LaundryOrder" DROP CONSTRAINT "LaundryOrder_reservationId_fkey";

-- DropForeignKey
ALTER TABLE "LockOperation" DROP CONSTRAINT "LockOperation_lockId_fkey";

-- DropForeignKey
ALTER TABLE "LockOperation" DROP CONSTRAINT "LockOperation_reservationId_fkey";

-- DropForeignKey
ALTER TABLE "LockOperation" DROP CONSTRAINT "LockOperation_roomId_fkey";

-- DropForeignKey
ALTER TABLE "NightAudit" DROP CONSTRAINT "NightAudit_runBy_fkey";

-- DropForeignKey
ALTER TABLE "NightAuditAcknowledgement" DROP CONSTRAINT "NightAuditAcknowledgement_acknowledgedBy_fkey";

-- DropForeignKey
ALTER TABLE "NightAuditAcknowledgement" DROP CONSTRAINT "NightAuditAcknowledgement_nightAuditId_fkey";

-- DropForeignKey
ALTER TABLE "NightAuditRun" DROP CONSTRAINT "NightAuditRun_propertyId_fkey";

-- DropForeignKey
ALTER TABLE "PosCashMovement" DROP CONSTRAINT "PosCashMovement_posSessionId_fkey";

-- DropForeignKey
ALTER TABLE "PosOrder" DROP CONSTRAINT "PosOrder_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "PosProductionBatchItem" DROP CONSTRAINT "PosProductionBatchItem_batchId_fkey";

-- DropForeignKey
ALTER TABLE "PosSession" DROP CONSTRAINT "PosSession_deviceId_fkey";

-- DropForeignKey
ALTER TABLE "ReconciliationException" DROP CONSTRAINT "ReconciliationException_frontdeskSessionId_fkey";

-- DropForeignKey
ALTER TABLE "RefundApproval" DROP CONSTRAINT "RefundApproval_refundRequestId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftControlAudit" DROP CONSTRAINT "ShiftControlAudit_frontdeskSessionId_fkey";

-- DropForeignKey
ALTER TABLE "ShiftControlAudit" DROP CONSTRAINT "ShiftControlAudit_performedBy_fkey";

-- DropForeignKey
ALTER TABLE "ShiftControlAudit" DROP CONSTRAINT "ShiftControlAudit_posSessionId_fkey";

-- DropIndex
DROP INDEX "ApprovalRequest_propertyId_status_idx";

-- DropIndex
DROP INDEX "ApprovalRequest_status_idx";

-- DropIndex
DROP INDEX "BankDeposit_depositReference_key";

-- DropIndex
DROP INDEX "CashAccount_propertyId_type_isDefault_idx";

-- DropIndex
DROP INDEX "CashExpense_categoryId_idx";

-- DropIndex
DROP INDEX "CashExpense_costCenterId_idx";

-- DropIndex
DROP INDEX "FolioItem_nightAuditRunId_idx";

-- DropIndex
DROP INDEX "NightAudit_propertyId_businessDate_idx";

-- DropIndex
DROP INDEX "NightAuditAcknowledgement_nightAuditId_idx";

-- DropIndex
DROP INDEX "Payment_propertyId_collectionSource_createdAt_idx";

-- DropIndex
DROP INDEX "PosProductModifier_stockItemId_idx";

-- DropIndex
DROP INDEX "PosProductionBatch_orderId_idx";

-- DropIndex
DROP INDEX "PosProductionBatch_station_status_idx";

-- DropIndex
DROP INDEX "PosProductionBatchItem_batchId_idx";

-- DropIndex
DROP INDEX "PosProductionBatchItem_orderItemId_idx";

-- AlterTable
ALTER TABLE "ApprovalRequest" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CashExpense" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DeviceToken" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "FrontdeskSession" DROP COLUMN "resolutionNotes";

-- AlterTable
ALTER TABLE "GuestServiceRequest" DROP COLUMN "currency",
DROP COLUMN "notes",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "NightAudit" DROP COLUMN "metadata",
ALTER COLUMN "businessDate" SET DATA TYPE DATE,
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "runBy" DROP NOT NULL,
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMPTZ,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "NightAuditAcknowledgement" DROP COLUMN "acknowledgedBy",
DROP COLUMN "createdAt",
DROP COLUMN "notes",
DROP COLUMN "referenceId",
DROP COLUMN "severity",
DROP COLUMN "type",
ADD COLUMN     "acknowledgedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "comment" TEXT,
ADD COLUMN     "reason" TEXT NOT NULL,
ADD COLUMN     "userId" UUID NOT NULL,
ADD COLUMN     "warningType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PosProductionBatch" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PosProductionBatchItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PosSession" DROP COLUMN "resolutionNotes",
ALTER COLUMN "deviceId" DROP NOT NULL,
ALTER COLUMN "bankingModel" DROP DEFAULT,
ALTER COLUMN "bankType" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "nightAuditHighBalanceThreshold" DECIMAL(18,4) NOT NULL DEFAULT 50000,
ADD COLUMN     "requireAuditAcknowledgements" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "cashVarianceNightAuditTolerance" DROP NOT NULL,
ALTER COLUMN "cashVarianceNightAuditTolerance" DROP DEFAULT,
ALTER COLUMN "cashVarianceNightAuditTolerance" SET DATA TYPE DECIMAL(18,4);

-- AlterTable
ALTER TABLE "RefundApprovalRule" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RefundRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReservationPriority" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- DropTable
DROP TABLE "NightAuditRun";

-- CreateTable
CREATE TABLE "KitchenWasteEntry" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "outletId" UUID,
    "stockItemId" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitOfMeasure" "UnitOfMeasure" NOT NULL,
    "baseQuantity" DECIMAL(18,4) NOT NULL,
    "unitCost" DECIMAL(18,4) NOT NULL,
    "totalValue" DECIMAL(18,4) NOT NULL,
    "reason" "KitchenWasteReason" NOT NULL,
    "notes" TEXT,
    "orderId" UUID,
    "productionBatchId" UUID,
    "status" "KitchenWasteStatus" NOT NULL DEFAULT 'SUBMITTED',
    "createdBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "rejectedBy" UUID,
    "rejectedAt" TIMESTAMPTZ,
    "rejectionReason" TEXT,
    "postedBy" UUID,
    "postedAt" TIMESTAMPTZ,
    "stockTransactionId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "KitchenWasteEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PosProductionBatchEvent" (
    "id" UUID NOT NULL,
    "batchId" UUID NOT NULL,
    "fromStatus" "PosProductionBatchStatus" NOT NULL,
    "toStatus" "PosProductionBatchStatus" NOT NULL,
    "actorId" UUID,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PosProductionBatchEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "KitchenWasteEntry_stockTransactionId_key" ON "KitchenWasteEntry"("stockTransactionId");

-- CreateIndex
CREATE INDEX "KitchenWasteEntry_propertyId_status_createdAt_idx" ON "KitchenWasteEntry"("propertyId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "KitchenWasteEntry_stockItemId_createdAt_idx" ON "KitchenWasteEntry"("stockItemId", "createdAt");

-- CreateIndex
CREATE INDEX "PosProductionBatchEvent_batchId_createdAt_idx" ON "PosProductionBatchEvent"("batchId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_organizationId_createdAt_idx" ON "AuditLog"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_propertyId_createdAt_idx" ON "AuditLog"("propertyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CashHandover_idempotencyKey_key" ON "CashHandover"("idempotencyKey");

-- AddForeignKey
ALTER TABLE "FolioItem" ADD CONSTRAINT "FolioItem_nightAuditRunId_fkey" FOREIGN KEY ("nightAuditRunId") REFERENCES "NightAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundApproval" ADD CONSTRAINT "RefundApproval_refundRequestId_fkey" FOREIGN KEY ("refundRequestId") REFERENCES "RefundRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightAuditAcknowledgement" ADD CONSTRAINT "NightAuditAcknowledgement_nightAuditId_fkey" FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockOperation" ADD CONSTRAINT "LockOperation_lockId_fkey" FOREIGN KEY ("lockId") REFERENCES "DoorLock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockOperation" ADD CONSTRAINT "LockOperation_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LockOperation" ADD CONSTRAINT "LockOperation_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenWasteEntry" ADD CONSTRAINT "KitchenWasteEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "KitchenWasteEntry" ADD CONSTRAINT "KitchenWasteEntry_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PosDevice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_cashAccountId_fkey" FOREIGN KEY ("cashAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ExpenseCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashExpense" ADD CONSTRAINT "CashExpense_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "PosSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FrontdeskSessionAudit" ADD CONSTRAINT "FrontdeskSessionAudit_frontdeskSessionId_fkey" FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReconciliationException" ADD CONSTRAINT "ReconciliationException_frontdeskSessionId_fkey" FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftControlAudit" ADD CONSTRAINT "ShiftControlAudit_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "PosSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftControlAudit" ADD CONSTRAINT "ShiftControlAudit_frontdeskSessionId_fkey" FOREIGN KEY ("frontdeskSessionId") REFERENCES "FrontdeskSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "PosSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrderItem" ADD CONSTRAINT "PosOrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "PosProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosProductionBatchEvent" ADD CONSTRAINT "PosProductionBatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PosProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosProductionBatchItem" ADD CONSTRAINT "PosProductionBatchItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PosProductionBatch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankDeposit" ADD CONSTRAINT "BankDeposit_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "CashAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

