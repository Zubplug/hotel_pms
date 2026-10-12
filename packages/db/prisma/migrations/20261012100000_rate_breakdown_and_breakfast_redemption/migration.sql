-- Rate Plan corporate food allocation toggle
ALTER TABLE "RatePlan"
  ADD COLUMN IF NOT EXISTS "includeFoodAllocation" BOOLEAN NOT NULL DEFAULT false;

-- Breakfast Redemption tracking
CREATE TABLE IF NOT EXISTS "BreakfastRedemption" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "roomNumber" TEXT NOT NULL,
    "businessDate" DATE NOT NULL,
    "coversRedeemed" INTEGER NOT NULL DEFAULT 1,
    "posOrderId" UUID,
    "method" TEXT NOT NULL DEFAULT 'POS_TICKET',
    "serverStaffId" UUID,
    "operationId" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakfastRedemption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BreakfastRedemption_operationId_key"
  ON "BreakfastRedemption"("operationId");

CREATE UNIQUE INDEX IF NOT EXISTS "BreakfastRedemption_propertyId_reservationId_businessDate_operationId_key"
  ON "BreakfastRedemption"("propertyId", "reservationId", "businessDate", "operationId");

CREATE INDEX IF NOT EXISTS "BreakfastRedemption_propertyId_businessDate_idx"
  ON "BreakfastRedemption"("propertyId", "businessDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakfastRedemption_propertyId_fkey'
  ) THEN
    ALTER TABLE "BreakfastRedemption"
      ADD CONSTRAINT "BreakfastRedemption_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakfastRedemption_reservationId_fkey'
  ) THEN
    ALTER TABLE "BreakfastRedemption"
      ADD CONSTRAINT "BreakfastRedemption_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BreakfastRedemption_posOrderId_fkey'
  ) THEN
    ALTER TABLE "BreakfastRedemption"
      ADD CONSTRAINT "BreakfastRedemption_posOrderId_fkey"
      FOREIGN KEY ("posOrderId") REFERENCES "PosOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
