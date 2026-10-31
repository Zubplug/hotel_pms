CREATE TABLE IF NOT EXISTS "BreakfastEligibilitySnapshot" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "redeemableBusinessDate" DATE NOT NULL,
    "reservationId" UUID NOT NULL,
    "reservationRoomId" UUID NOT NULL,
    "guestId" UUID NOT NULL,
    "roomId" UUID,
    "roomNumber" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "maxCoversAllowed" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ELIGIBLE',
    "reason" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BreakfastEligibilitySnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "BreakfastEligibilitySnapshot_propertyId_redeemableBusinessDate_reservationRoomId_key"
    ON "BreakfastEligibilitySnapshot"("propertyId", "redeemableBusinessDate", "reservationRoomId");
CREATE INDEX IF NOT EXISTS "BreakfastEligibilitySnapshot_propertyId_redeemableBusinessDate_idx"
    ON "BreakfastEligibilitySnapshot"("propertyId", "redeemableBusinessDate");
CREATE INDEX IF NOT EXISTS "BreakfastEligibilitySnapshot_propertyId_businessDate_idx"
    ON "BreakfastEligibilitySnapshot"("propertyId", "businessDate");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'BreakfastEligibilitySnapshot_propertyId_fkey'
    ) THEN
        ALTER TABLE "BreakfastEligibilitySnapshot"
            ADD CONSTRAINT "BreakfastEligibilitySnapshot_propertyId_fkey"
            FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "Property"
    ADD COLUMN IF NOT EXISTS "breakfastEligibilitySnapshotDate" DATE;
