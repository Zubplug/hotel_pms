CREATE TYPE "KitchenWasteStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'POSTED');
CREATE TYPE "KitchenWasteReason" AS ENUM ('SPOILAGE', 'OVER_PRODUCTION', 'BURNED', 'DAMAGED', 'RETURNED', 'WRONG_ORDER', 'OTHER');

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
  CONSTRAINT "KitchenWasteEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "KitchenWasteEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "KitchenWasteEntry_stockItemId_fkey" FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KitchenWasteEntry_stockTransactionId_key" ON "KitchenWasteEntry"("stockTransactionId");
CREATE INDEX "KitchenWasteEntry_propertyId_status_createdAt_idx" ON "KitchenWasteEntry"("propertyId", "status", "createdAt");
CREATE INDEX "KitchenWasteEntry_stockItemId_createdAt_idx" ON "KitchenWasteEntry"("stockItemId", "createdAt");

CREATE TABLE "PosProductionBatchEvent" (
  "id" UUID NOT NULL,
  "batchId" UUID NOT NULL,
  "fromStatus" "PosProductionBatchStatus" NOT NULL,
  "toStatus" "PosProductionBatchStatus" NOT NULL,
  "actorId" UUID,
  "notes" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosProductionBatchEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PosProductionBatchEvent_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PosProductionBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "PosProductionBatchEvent_batchId_createdAt_idx" ON "PosProductionBatchEvent"("batchId", "createdAt");
