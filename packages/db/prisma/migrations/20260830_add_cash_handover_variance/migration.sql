-- AlterTable
ALTER TABLE "CashHandover" ADD COLUMN "actualAmount" DECIMAL(18,4);
ALTER TABLE "CashHandover" ADD COLUMN "variance" DECIMAL(18,4);
ALTER TABLE "CashHandover" ADD COLUMN "reasonCode" "VarianceReasonCode";
