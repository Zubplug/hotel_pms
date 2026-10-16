-- Optional room-type-level Reach commission overrides.
ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "referralEnabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "referralCommissionMode" TEXT NOT NULL DEFAULT 'PERCENT';
ALTER TABLE "RoomType" ADD COLUMN IF NOT EXISTS "referralCommissionValue" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "ReferralBooking" ADD COLUMN IF NOT EXISTS "roomTypeId" UUID;
CREATE INDEX IF NOT EXISTS "ReferralBooking_roomTypeId_idx" ON "ReferralBooking"("roomTypeId");
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ReferralBooking_roomTypeId_fkey') THEN
    ALTER TABLE "ReferralBooking" ADD CONSTRAINT "ReferralBooking_roomTypeId_fkey"
      FOREIGN KEY ("roomTypeId") REFERENCES "RoomType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
