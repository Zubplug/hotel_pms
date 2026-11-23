CREATE TABLE IF NOT EXISTS "GuestAmenityFulfillment" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "nightAuditId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "roomId" UUID,
    "stockItemId" UUID,
    "warehouseId" UUID,
    "businessDate" DATE NOT NULL,
    "amenityKey" TEXT NOT NULL,
    "amenityName" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "guestCount" INTEGER NOT NULL,
    "requiredQuantity" DECIMAL(18,4) NOT NULL,
    "issuedQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "shortageQuantity" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "stockBefore" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "stockAfter" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "totalValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "estimatedShortageValue" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "operationId" TEXT NOT NULL,
    "voidedAt" TIMESTAMPTZ,
    "voidedByNightAuditId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "GuestAmenityFulfillment_pkey" PRIMARY KEY ("id")
);

-- This migration may be replayed in environments where the table was created
-- during an earlier deployment. Add only the lifecycle columns that may not
-- exist yet; all other definitions are part of the original table creation.
ALTER TABLE "GuestAmenityFulfillment"
    ADD COLUMN IF NOT EXISTS "voidedAt" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "voidedByNightAuditId" UUID;

CREATE UNIQUE INDEX IF NOT EXISTS "GuestAmenityFulfillment_operationId_key"
    ON "GuestAmenityFulfillment"("operationId");
CREATE INDEX IF NOT EXISTS "GuestAmenityFulfillment_propertyId_businessDate_status_idx"
    ON "GuestAmenityFulfillment"("propertyId", "businessDate", "status");
CREATE INDEX IF NOT EXISTS "GuestAmenityFulfillment_reservationId_businessDate_idx"
    ON "GuestAmenityFulfillment"("reservationId", "businessDate");
CREATE INDEX IF NOT EXISTS "GuestAmenityFulfillment_nightAuditId_idx"
    ON "GuestAmenityFulfillment"("nightAuditId");
CREATE INDEX IF NOT EXISTS "GuestAmenityFulfillment_propertyId_status_voidedAt_idx"
    ON "GuestAmenityFulfillment"("propertyId", "status", "voidedAt");

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestAmenityFulfillment_propertyId_fkey') THEN
        ALTER TABLE "GuestAmenityFulfillment" ADD CONSTRAINT "GuestAmenityFulfillment_propertyId_fkey"
            FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestAmenityFulfillment_nightAuditId_fkey') THEN
        ALTER TABLE "GuestAmenityFulfillment" ADD CONSTRAINT "GuestAmenityFulfillment_nightAuditId_fkey"
            FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestAmenityFulfillment_reservationId_fkey') THEN
        ALTER TABLE "GuestAmenityFulfillment" ADD CONSTRAINT "GuestAmenityFulfillment_reservationId_fkey"
            FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestAmenityFulfillment_roomId_fkey') THEN
        ALTER TABLE "GuestAmenityFulfillment" ADD CONSTRAINT "GuestAmenityFulfillment_roomId_fkey"
            FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestAmenityFulfillment_stockItemId_fkey') THEN
        ALTER TABLE "GuestAmenityFulfillment" ADD CONSTRAINT "GuestAmenityFulfillment_stockItemId_fkey"
            FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestAmenityFulfillment_warehouseId_fkey') THEN
        ALTER TABLE "GuestAmenityFulfillment" ADD CONSTRAINT "GuestAmenityFulfillment_warehouseId_fkey"
            FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'GuestAmenityFulfillment_voidedByNightAuditId_fkey') THEN
        ALTER TABLE "GuestAmenityFulfillment" ADD CONSTRAINT "GuestAmenityFulfillment_voidedByNightAuditId_fkey"
            FOREIGN KEY ("voidedByNightAuditId") REFERENCES "NightAudit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;
