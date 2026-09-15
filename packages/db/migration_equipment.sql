-- CreateTable
CREATE TABLE "EventEquipmentBooking" (
    "id" UUID NOT NULL,
    "eventBookingId" UUID NOT NULL,
    "equipmentId" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "EventEquipmentBooking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EventEquipmentBooking_eventBookingId_equipmentId_idx" ON "EventEquipmentBooking"("eventBookingId", "equipmentId");

-- AddForeignKey
ALTER TABLE "EventEquipmentBooking" ADD CONSTRAINT "EventEquipmentBooking_eventBookingId_fkey" FOREIGN KEY ("eventBookingId") REFERENCES "EventBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventEquipmentBooking" ADD CONSTRAINT "EventEquipmentBooking_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "EventEquipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
