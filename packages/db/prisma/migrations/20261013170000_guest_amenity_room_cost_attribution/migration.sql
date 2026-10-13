-- Link complimentary amenity consumption to the stay and room for
-- room-level net contribution reporting.
ALTER TABLE "StockTransaction"
  ADD COLUMN IF NOT EXISTS "reservationId" UUID,
  ADD COLUMN IF NOT EXISTS "roomId" UUID;

CREATE INDEX IF NOT EXISTS "StockTransaction_propertyId_reservationId_businessDate_idx"
  ON "StockTransaction"("propertyId", "reservationId", "businessDate");
CREATE INDEX IF NOT EXISTS "StockTransaction_propertyId_roomId_businessDate_idx"
  ON "StockTransaction"("propertyId", "roomId", "businessDate");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransaction_reservationId_fkey') THEN
    ALTER TABLE "StockTransaction"
      ADD CONSTRAINT "StockTransaction_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StockTransaction_roomId_fkey') THEN
    ALTER TABLE "StockTransaction"
      ADD CONSTRAINT "StockTransaction_roomId_fkey"
      FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
