DELETE FROM "SyncConflict";
-- DropIndex
DROP INDEX "SyncConflict_operationId_key";

-- AlterTable
ALTER TABLE "SyncConflict" DROP COLUMN "entityId",
DROP COLUMN "entityType",
DROP COLUMN "operationId",
DROP COLUMN "payload",
ADD COLUMN     "aggregateId" UUID NOT NULL,
ADD COLUMN     "aggregateType" TEXT NOT NULL,
ADD COLUMN     "expectedVersion" INTEGER NOT NULL,
ADD COLUMN     "hotelEventId" UUID NOT NULL,
ADD COLUMN     "receivedVersion" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "PosSession" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PosOrder" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "HotelEvent" (
    "id" UUID NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "propertyId" UUID NOT NULL,
    "deviceId" TEXT,
    "operatorId" TEXT,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" UUID NOT NULL,
    "aggregateVersion" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "occurredAt" TIMESTAMPTZ NOT NULL,
    "sequence" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HotelEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelEvent_idempotencyKey_key" ON "HotelEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HotelEvent_aggregateType_aggregateId_aggregateVersion_idx" ON "HotelEvent"("aggregateType", "aggregateId", "aggregateVersion");

-- CreateIndex
CREATE INDEX "HotelEvent_propertyId_idx" ON "HotelEvent"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncConflict_hotelEventId_key" ON "SyncConflict"("hotelEventId");

-- AddForeignKey
ALTER TABLE "HotelEvent" ADD CONSTRAINT "HotelEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_hotelEventId_fkey" FOREIGN KEY ("hotelEventId") REFERENCES "HotelEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

