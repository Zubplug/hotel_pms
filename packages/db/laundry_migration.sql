-- CreateEnum
CREATE TYPE "LaundryOrderStatus" AS ENUM ('PENDING', 'COLLECTED', 'WASHING', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "LaundryServiceType" AS ENUM ('STANDARD', 'EXPRESS', 'SAME_DAY', 'DRY_CLEAN', 'IRON_ONLY', 'WASH_AND_FOLD');

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

-- AlterTable
ALTER TABLE "PosCheck" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "pos_operator_sessions" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

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

-- CreateTable
CREATE TABLE "LaundryItem" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "description" TEXT,
    "basePrice" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "servicePricingRules" JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LaundryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryOrder" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "roomId" UUID,
    "guestId" UUID,
    "folioItemId" UUID,
    "status" "LaundryOrderStatus" NOT NULL DEFAULT 'PENDING',
    "serviceType" "LaundryServiceType" NOT NULL DEFAULT 'STANDARD',
    "totalAmount" DECIMAL(18,4) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'NGN',
    "specialNotes" TEXT,
    "requestedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expectedReadyAt" TIMESTAMPTZ,
    "collectedAt" TIMESTAMPTZ,
    "collectedBy" UUID,
    "readyAt" TIMESTAMPTZ,
    "deliveredAt" TIMESTAMPTZ,
    "deliveredBy" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "LaundryOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryOrderItem" (
    "id" UUID NOT NULL,
    "laundryOrderId" UUID NOT NULL,
    "itemId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(18,4) NOT NULL,
    "totalPrice" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "LaundryOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LaundryOrderStatusHistory" (
    "id" UUID NOT NULL,
    "laundryOrderId" UUID NOT NULL,
    "previousStatus" "LaundryOrderStatus",
    "newStatus" "LaundryOrderStatus" NOT NULL,
    "changedBy" UUID,
    "changedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "deviceId" TEXT,

    CONSTRAINT "LaundryOrderStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HotelEvent_idempotencyKey_key" ON "HotelEvent"("idempotencyKey");

-- CreateIndex
CREATE INDEX "HotelEvent_aggregateType_aggregateId_aggregateVersion_idx" ON "HotelEvent"("aggregateType", "aggregateId", "aggregateVersion");

-- CreateIndex
CREATE INDEX "HotelEvent_propertyId_idx" ON "HotelEvent"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "HotelEvent_aggregateType_aggregateId_aggregateVersion_key" ON "HotelEvent"("aggregateType", "aggregateId", "aggregateVersion");

-- CreateIndex
CREATE UNIQUE INDEX "LaundryOrder_folioItemId_key" ON "LaundryOrder"("folioItemId");

-- CreateIndex
CREATE UNIQUE INDEX "SyncConflict_hotelEventId_key" ON "SyncConflict"("hotelEventId");

-- AddForeignKey
ALTER TABLE "HotelEvent" ADD CONSTRAINT "HotelEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SyncConflict" ADD CONSTRAINT "SyncConflict_hotelEventId_fkey" FOREIGN KEY ("hotelEventId") REFERENCES "HotelEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryItem" ADD CONSTRAINT "LaundryItem_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrder" ADD CONSTRAINT "LaundryOrder_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrderItem" ADD CONSTRAINT "LaundryOrderItem_laundryOrderId_fkey" FOREIGN KEY ("laundryOrderId") REFERENCES "LaundryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrderItem" ADD CONSTRAINT "LaundryOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LaundryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LaundryOrderStatusHistory" ADD CONSTRAINT "LaundryOrderStatusHistory_laundryOrderId_fkey" FOREIGN KEY ("laundryOrderId") REFERENCES "LaundryOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

