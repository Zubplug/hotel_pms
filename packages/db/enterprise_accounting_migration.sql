-- CreateEnum
CREATE TYPE "SupplierInvoiceStatus" AS ENUM ('RECEIVED', 'UNDER_REVIEW', 'APPROVED', 'PARTIAL', 'PAID', 'DISPUTED', 'OVERDUE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TaxRemittanceStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REMITTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AccountingPeriodStatus" AS ENUM ('OPEN', 'CLOSING', 'CLOSED');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "BalanceSide" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'REVERSED', 'VOID');

-- CreateEnum
CREATE TYPE "PayrollPeriodStatus" AS ENUM ('DRAFT', 'PROCESSING', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayslipStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'PAID');

-- CreateEnum
CREATE TYPE "AssetStatus" AS ENUM ('ACTIVE', 'DISPOSED', 'FULLY_DEPRECIATED', 'UNDER_MAINTENANCE', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "DepreciationMethod" AS ENUM ('STRAIGHT_LINE', 'REDUCING_BALANCE', 'UNITS_OF_PRODUCTION');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'ACTIVE', 'CLOSED');

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "purchaseOrderId" UUID,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "receivedDate" DATE,
    "subtotal" DECIMAL(18,4) NOT NULL,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "paidAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "outstandingAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "SupplierInvoiceStatus" NOT NULL DEFAULT 'RECEIVED',
    "notes" TEXT,
    "attachmentUrl" TEXT,
    "createdBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceGRN" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "grnId" UUID NOT NULL,
    "allocatedAmount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "SupplierInvoiceGRN_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoiceItem" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "grnItemId" UUID,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "totalPrice" DECIMAL(18,4) NOT NULL,
    "taxAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,

    CONSTRAINT "SupplierInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "supplierId" UUID NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "paymentDate" DATE NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "bankReference" TEXT,
    "paymentReference" TEXT NOT NULL,
    "notes" TEXT,
    "paidBy" UUID NOT NULL,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaxRemittance" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "taxId" UUID,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "taxType" TEXT NOT NULL,
    "collectedAmount" DECIMAL(18,4) NOT NULL,
    "remittedAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "remittanceDate" DATE NOT NULL,
    "remittanceRef" TEXT,
    "authorityName" TEXT,
    "attachmentUrl" TEXT,
    "notes" TEXT,
    "status" "TaxRemittanceStatus" NOT NULL DEFAULT 'DRAFT',
    "recordedBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "TaxRemittance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountingPeriod" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "AccountingPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "openedBy" UUID,
    "closedBy" UUID,
    "closedAt" TIMESTAMPTZ,
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "AccountingPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "category" TEXT NOT NULL,
    "normalBalance" "BalanceSide" NOT NULL,
    "parentCode" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "periodId" UUID,
    "entryNumber" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "source" TEXT NOT NULL DEFAULT 'MANUAL',
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "totalDebit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalCredit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isReversed" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfId" UUID,
    "postedBy" UUID,
    "postedAt" TIMESTAMPTZ,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntryLine" (
    "id" UUID NOT NULL,
    "entryId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sourceType" TEXT,
    "sourceId" UUID,

    CONSTRAINT "JournalEntryLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalaryStructure" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "basicSalary" DECIMAL(18,4) NOT NULL,
    "housingAllowance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "transportAllowance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherAllowances" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "bankName" TEXT,
    "bankAccountNumber" TEXT,
    "bankSortCode" TEXT,
    "pensionFundAdmin" TEXT,
    "pensionNumber" TEXT,
    "effectiveFrom" DATE NOT NULL,
    "effectiveTo" DATE,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "SalaryStructure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollPeriod" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "paymentDate" DATE,
    "status" "PayrollPeriodStatus" NOT NULL DEFAULT 'DRAFT',
    "totalGross" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalNet" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalEmployerPension" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalPAYE" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "createdBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "processedBy" UUID,
    "processedAt" TIMESTAMPTZ,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PayrollPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" UUID NOT NULL,
    "payrollPeriodId" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "basicSalary" DECIMAL(18,4) NOT NULL,
    "housingAllowance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "transportAllowance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherAllowances" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "overtime" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "grossEarnings" DECIMAL(18,4) NOT NULL,
    "payeTax" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pensionEmployee" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "pensionEmployer" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "nhf" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "nsitf" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "staffLiabilityDeductions" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "loanDeductions" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalDeductions" DECIMAL(18,4) NOT NULL,
    "netPay" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "PayslipStatus" NOT NULL DEFAULT 'DRAFT',
    "bankName" TEXT,
    "accountNumber" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipComponent" (
    "id" UUID NOT NULL,
    "payslipId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayslipComponent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAssetCategory" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL DEFAULT 'STRAIGHT_LINE',
    "usefulLifeYears" INTEGER NOT NULL,
    "salvagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "glAccountCode" TEXT,
    "depreciationGlCode" TEXT,
    "accumulatedGlCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FixedAssetCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixedAsset" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "assetNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "location" TEXT,
    "acquisitionDate" DATE NOT NULL,
    "acquisitionCost" DECIMAL(18,4) NOT NULL,
    "salvageValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "usefulLifeYears" INTEGER NOT NULL,
    "depreciationMethod" "DepreciationMethod" NOT NULL,
    "currentBookValue" DECIMAL(18,4) NOT NULL,
    "accumulatedDepreciation" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" "AssetStatus" NOT NULL DEFAULT 'ACTIVE',
    "disposalDate" DATE,
    "disposalAmount" DECIMAL(18,4),
    "disposalReason" TEXT,
    "supplier" TEXT,
    "invoiceRef" TEXT,
    "warrantyExpiry" DATE,
    "createdBy" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "FixedAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetDepreciation" (
    "id" UUID NOT NULL,
    "assetId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "periodId" UUID,
    "depreciationDate" DATE NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "bookValueBefore" DECIMAL(18,4) NOT NULL,
    "bookValueAfter" DECIMAL(18,4) NOT NULL,
    "accumulatedAfter" DECIMAL(18,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "postedBy" UUID,
    "journalEntryId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetDepreciation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "budgetType" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRevenueBudget" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalExpenseBudget" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "createdBy" UUID NOT NULL,
    "approvedBy" UUID,
    "approvedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLine" (
    "id" UUID NOT NULL,
    "budgetId" UUID NOT NULL,
    "category" TEXT NOT NULL,
    "department" TEXT,
    "description" TEXT,
    "jan" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "feb" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "mar" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "apr" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "may" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "jun" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "jul" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "aug" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "sep" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "oct" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "nov" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "dec" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "BudgetLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SupplierInvoice_propertyId_status_idx" ON "SupplierInvoice"("propertyId", "status");

-- CreateIndex
CREATE INDEX "SupplierInvoice_propertyId_dueDate_idx" ON "SupplierInvoice"("propertyId", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_idx" ON "SupplierInvoice"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_propertyId_invoiceNumber_key" ON "SupplierInvoice"("propertyId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "SupplierInvoiceGRN_invoiceId_idx" ON "SupplierInvoiceGRN"("invoiceId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceGRN_grnId_idx" ON "SupplierInvoiceGRN"("grnId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoiceGRN_invoiceId_grnId_key" ON "SupplierInvoiceGRN"("invoiceId", "grnId");

-- CreateIndex
CREATE INDEX "SupplierInvoiceItem_invoiceId_idx" ON "SupplierInvoiceItem"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPayment_paymentReference_key" ON "SupplierPayment"("paymentReference");

-- CreateIndex
CREATE INDEX "SupplierPayment_propertyId_paymentDate_idx" ON "SupplierPayment"("propertyId", "paymentDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_invoiceId_idx" ON "SupplierPayment"("invoiceId");

-- CreateIndex
CREATE INDEX "TaxRemittance_propertyId_periodStart_periodEnd_idx" ON "TaxRemittance"("propertyId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "TaxRemittance_propertyId_status_idx" ON "TaxRemittance"("propertyId", "status");

-- CreateIndex
CREATE INDEX "AccountingPeriod_propertyId_status_idx" ON "AccountingPeriod"("propertyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountingPeriod_propertyId_periodStart_key" ON "AccountingPeriod"("propertyId", "periodStart");

-- CreateIndex
CREATE INDEX "ChartOfAccount_propertyId_type_idx" ON "ChartOfAccount"("propertyId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_propertyId_code_key" ON "ChartOfAccount"("propertyId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_entryNumber_key" ON "JournalEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "JournalEntry_propertyId_entryDate_idx" ON "JournalEntry"("propertyId", "entryDate");

-- CreateIndex
CREATE INDEX "JournalEntry_propertyId_status_idx" ON "JournalEntry"("propertyId", "status");

-- CreateIndex
CREATE INDEX "JournalEntry_propertyId_periodId_idx" ON "JournalEntry"("propertyId", "periodId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_entryId_idx" ON "JournalEntryLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalEntryLine_accountId_idx" ON "JournalEntryLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "SalaryStructure_staffId_key" ON "SalaryStructure"("staffId");

-- CreateIndex
CREATE INDEX "PayrollPeriod_propertyId_status_idx" ON "PayrollPeriod"("propertyId", "status");

-- CreateIndex
CREATE INDEX "PayrollPeriod_organizationId_startDate_idx" ON "PayrollPeriod"("organizationId", "startDate");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollPeriod_organizationId_propertyId_startDate_key" ON "PayrollPeriod"("organizationId", "propertyId", "startDate");

-- CreateIndex
CREATE INDEX "Payslip_propertyId_payrollPeriodId_idx" ON "Payslip"("propertyId", "payrollPeriodId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrollPeriodId_staffId_key" ON "Payslip"("payrollPeriodId", "staffId");

-- CreateIndex
CREATE INDEX "PayslipComponent_payslipId_idx" ON "PayslipComponent"("payslipId");

-- CreateIndex
CREATE UNIQUE INDEX "FixedAsset_assetNumber_key" ON "FixedAsset"("assetNumber");

-- CreateIndex
CREATE INDEX "FixedAsset_propertyId_status_idx" ON "FixedAsset"("propertyId", "status");

-- CreateIndex
CREATE INDEX "FixedAsset_propertyId_categoryId_idx" ON "FixedAsset"("propertyId", "categoryId");

-- CreateIndex
CREATE INDEX "AssetDepreciation_assetId_depreciationDate_idx" ON "AssetDepreciation"("assetId", "depreciationDate");

-- CreateIndex
CREATE INDEX "AssetDepreciation_propertyId_depreciationDate_idx" ON "AssetDepreciation"("propertyId", "depreciationDate");

-- CreateIndex
CREATE INDEX "Budget_propertyId_status_idx" ON "Budget"("propertyId", "status");

-- CreateIndex
CREATE INDEX "Budget_propertyId_periodStart_idx" ON "Budget"("propertyId", "periodStart");

-- CreateIndex
CREATE INDEX "BudgetLine_budgetId_category_idx" ON "BudgetLine"("budgetId", "category");

-- Clean up orphaned references in CheckInBypass before adding the constraint
UPDATE "CheckInBypass" SET "reviewedByStaffId" = NULL WHERE "reviewedByStaffId" IS NOT NULL AND "reviewedByStaffId" NOT IN (SELECT "id" FROM "Staff");

-- AddForeignKey
ALTER TABLE "CheckInBypass" ADD CONSTRAINT "CheckInBypass_reviewedByStaffId_fkey" FOREIGN KEY ("reviewedByStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceGRN" ADD CONSTRAINT "SupplierInvoiceGRN_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceGRN" ADD CONSTRAINT "SupplierInvoiceGRN_grnId_fkey" FOREIGN KEY ("grnId") REFERENCES "GoodsReceivedNote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoiceItem" ADD CONSTRAINT "SupplierInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRemittance" ADD CONSTRAINT "TaxRemittance_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaxRemittance" ADD CONSTRAINT "TaxRemittance_taxId_fkey" FOREIGN KEY ("taxId") REFERENCES "Tax"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountingPeriod" ADD CONSTRAINT "AccountingPeriod_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalaryStructure" ADD CONSTRAINT "SalaryStructure_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollPeriod" ADD CONSTRAINT "PayrollPeriod_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollPeriodId_fkey" FOREIGN KEY ("payrollPeriodId") REFERENCES "PayrollPeriod"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipComponent" ADD CONSTRAINT "PayslipComponent_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAssetCategory" ADD CONSTRAINT "FixedAssetCategory_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixedAsset" ADD CONSTRAINT "FixedAsset_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FixedAssetCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciation" ADD CONSTRAINT "AssetDepreciation_assetId_fkey" FOREIGN KEY ("assetId") REFERENCES "FixedAsset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciation" ADD CONSTRAINT "AssetDepreciation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetDepreciation" ADD CONSTRAINT "AssetDepreciation_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "AccountingPeriod"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Budget" ADD CONSTRAINT "Budget_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLine" ADD CONSTRAINT "BudgetLine_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

