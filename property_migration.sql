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
