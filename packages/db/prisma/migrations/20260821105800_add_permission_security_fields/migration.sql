-- AlterTable
ALTER TABLE "Permission" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "requiresApproval" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "riskLevel" TEXT NOT NULL DEFAULT 'LOW';

