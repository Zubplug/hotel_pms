-- CreateEnum
CREATE TYPE "EventLeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'PROPOSAL_SENT', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "EventFinancialStatus" AS ENUM ('QUOTE', 'DEPOSIT_DUE', 'PARTIALLY_PAID', 'PAID', 'AR_OUTSTANDING', 'SETTLED');

-- CreateEnum
CREATE TYPE "BeoStatus" AS ENUM ('DRAFT', 'REVIEW', 'APPROVED', 'ISSUED', 'AMENDED');

-- AlterEnum
BEGIN;
CREATE TYPE "EventStatus_new" AS ENUM ('INQUIRY', 'TENTATIVE', 'CONFIRMED', 'IN_SERVICE', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Event" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Event" ALTER COLUMN "status" TYPE "EventStatus_new" USING ("status"::text::"EventStatus_new");
ALTER TYPE "EventStatus" RENAME TO "EventStatus_old";
ALTER TYPE "EventStatus_new" RENAME TO "EventStatus";
DROP TYPE "EventStatus_old";
ALTER TABLE "Event" ALTER COLUMN "status" SET DEFAULT 'INQUIRY';
COMMIT;

-- DropForeignKey
ALTER TABLE "EventInvoice" DROP CONSTRAINT "EventInvoice_eventId_fkey";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "banquetPackageId" UUID,
ADD COLUMN     "financialStatus" "EventFinancialStatus" NOT NULL DEFAULT 'QUOTE';

-- AlterTable
ALTER TABLE "EventBooking" DROP COLUMN "setupNotes",
ADD COLUMN     "setupBufferMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "teardownBufferMinutes" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EventInvoice" ADD COLUMN     "cityLedgerAccountId" UUID,
ADD COLUMN     "folioId" UUID,
ALTER COLUMN "eventId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Hall" ADD COLUMN     "dailyRate" DECIMAL(18,4),
ADD COLUMN     "hourlyRate" DECIMAL(18,4),
ADD COLUMN     "monthlyRate" DECIMAL(18,4),
ADD COLUMN     "yearlyRate" DECIMAL(18,4);

-- CreateTable
CREATE TABLE "EventLead" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "companyName" TEXT,
    "eventType" TEXT,
    "expectedGuests" INTEGER,
    "preferredDate" DATE,
    "status" "EventLeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EventLead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventEquipment" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "totalStock" INTEGER NOT NULL DEFAULT 1,
    "rentalPrice" DECIMAL(18,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EventEquipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetPackage" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "basePrice" DECIMAL(18,4) NOT NULL,
    "isHallOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BanquetPackage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetPackageItem" (
    "id" UUID NOT NULL,
    "banquetPackageId" UUID NOT NULL,
    "posProductId" UUID,
    "nameOverride" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "priceOverride" DECIMAL(18,4),

    CONSTRAINT "BanquetPackageItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseContract" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "hallId" UUID NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "billingFrequency" TEXT NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "depositAmount" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "cancellationTerms" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LeaseContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LeaseBillingSchedule" (
    "id" UUID NOT NULL,
    "leaseContractId" UUID NOT NULL,
    "dueDate" DATE NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invoiceId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeaseBillingSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BanquetEventOrder" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "BeoStatus" NOT NULL DEFAULT 'DRAFT',
    "snapshotData" JSONB NOT NULL,
    "issuedAt" TIMESTAMPTZ,
    "approvedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "BanquetEventOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventChangeOrder" (
    "id" UUID NOT NULL,
    "eventId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "commercialImpact" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" UUID,
    "approvedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvoiceItem" (
    "id" UUID NOT NULL,
    "invoiceId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "totalPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "EventInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BanquetPackageItem_banquetPackageId_idx" ON "BanquetPackageItem"("banquetPackageId");

-- CreateIndex
CREATE INDEX "EventBooking_hallId_startTime_endTime_idx" ON "EventBooking"("hallId", "startTime", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_propertyId_nightAuditId_key" ON "JournalEntry"("propertyId", "nightAuditId");

-- CreateIndex
CREATE UNIQUE INDEX "NightAuditFinancialSnapshot_snapshotHash_key" ON "NightAuditFinancialSnapshot"("snapshotHash");

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventLead" ADD CONSTRAINT "EventLead_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEquipment" ADD CONSTRAINT "EventEquipment_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetPackage" ADD CONSTRAINT "BanquetPackage_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetPackageItem" ADD CONSTRAINT "BanquetPackageItem_banquetPackageId_fkey" FOREIGN KEY ("banquetPackageId") REFERENCES "BanquetPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetPackageItem" ADD CONSTRAINT "BanquetPackageItem_posProductId_fkey" FOREIGN KEY ("posProductId") REFERENCES "PosProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_banquetPackageId_fkey" FOREIGN KEY ("banquetPackageId") REFERENCES "BanquetPackage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseContract" ADD CONSTRAINT "LeaseContract_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseContract" ADD CONSTRAINT "LeaseContract_hallId_fkey" FOREIGN KEY ("hallId") REFERENCES "Hall"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeaseBillingSchedule" ADD CONSTRAINT "LeaseBillingSchedule_leaseContractId_fkey" FOREIGN KEY ("leaseContractId") REFERENCES "LeaseContract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BanquetEventOrder" ADD CONSTRAINT "BanquetEventOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChangeOrder" ADD CONSTRAINT "EventChangeOrder_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvoice" ADD CONSTRAINT "EventInvoice_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvoice" ADD CONSTRAINT "EventInvoice_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvoice" ADD CONSTRAINT "EventInvoice_cityLedgerAccountId_fkey" FOREIGN KEY ("cityLedgerAccountId") REFERENCES "CityLedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvoiceItem" ADD CONSTRAINT "EventInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "EventInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntryLine" ADD CONSTRAINT "JournalEntryLine_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "PosOutlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

