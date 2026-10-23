ALTER TABLE "Refund"
ADD COLUMN "bookingPaymentTransactionId" UUID;

CREATE UNIQUE INDEX "Refund_bookingPaymentTransactionId_key"
ON "Refund"("bookingPaymentTransactionId");

ALTER TABLE "Refund"
ADD CONSTRAINT "Refund_bookingPaymentTransactionId_fkey"
FOREIGN KEY ("bookingPaymentTransactionId") REFERENCES "BookingPaymentTransaction"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
