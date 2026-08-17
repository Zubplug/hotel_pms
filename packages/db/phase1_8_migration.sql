-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'RETIRED');

-- AlterTable
ALTER TABLE "PosSession" DROP COLUMN "deviceId",
ADD COLUMN     "deviceId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "PosDevice" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "outletId" UUID,
    "status" "DeviceStatus" NOT NULL DEFAULT 'PENDING',
    "lastSeenAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PosDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPosOutletAccess" (
    "id" UUID NOT NULL,
    "staffId" UUID NOT NULL,
    "outletId" UUID NOT NULL,
    "assignedBy" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPosOutletAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PosDevice_identifier_key" ON "PosDevice"("identifier");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPosOutletAccess_staffId_outletId_key" ON "StaffPosOutletAccess"("staffId", "outletId");

-- AddForeignKey
ALTER TABLE "PosDevice" ADD CONSTRAINT "PosDevice_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosDevice" ADD CONSTRAINT "PosDevice_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "PosOutlet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPosOutletAccess" ADD CONSTRAINT "StaffPosOutletAccess_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPosOutletAccess" ADD CONSTRAINT "StaffPosOutletAccess_outletId_fkey" FOREIGN KEY ("outletId") REFERENCES "PosOutlet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "PosDevice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosOrder" ADD CONSTRAINT "PosOrder_serverStaffId_fkey" FOREIGN KEY ("serverStaffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS pos_session_device_open_idx ON "PosSession"("deviceId") WHERE status = 'OPEN';
