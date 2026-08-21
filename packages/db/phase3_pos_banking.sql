-- Add new Handover types to the enum
ALTER TYPE "PosCashMovementType" ADD VALUE 'SERVER_HANDOVER';
ALTER TYPE "PosCashMovementType" ADD VALUE 'STATION_HANDOVER';
ALTER TYPE "PosCashMovementType" ADD VALUE 'EMERGENCY_HANDOVER';

-- Create the new CashAccount table
CREATE TABLE "CashAccount" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "outletId" UUID,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "ownerId" UUID,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "CashAccount_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys for CashAccount
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "PosOutlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CashAccount" ADD CONSTRAINT "CashAccount_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Update PosCashMovement table to support new double-entry ledger fields
ALTER TABLE "PosCashMovement" ALTER COLUMN "posSessionId" DROP NOT NULL;
ALTER TABLE "PosCashMovement" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'NGN';
ALTER TABLE "PosCashMovement" ADD COLUMN "sourceAccountId" UUID NOT NULL;
ALTER TABLE "PosCashMovement" ADD COLUMN "destinationAccountId" UUID NOT NULL;

-- Add foreign keys for PosCashMovement source and destination
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PosCashMovement" ADD CONSTRAINT "PosCashMovement_destinationAccountId_fkey" FOREIGN KEY ("destinationAccountId") REFERENCES "CashAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
