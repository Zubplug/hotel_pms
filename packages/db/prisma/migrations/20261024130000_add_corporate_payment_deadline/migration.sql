ALTER TABLE "Reservation" ADD COLUMN "paymentExpiresAt" TIMESTAMPTZ;
CREATE INDEX "Reservation_status_paymentExpiresAt_idx" ON "Reservation"("status", "paymentExpiresAt");
