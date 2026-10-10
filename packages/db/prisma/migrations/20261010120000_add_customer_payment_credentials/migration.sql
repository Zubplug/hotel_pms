ALTER TABLE "BookingPaymentAccount"
  ADD COLUMN "secretCiphertext" TEXT,
  ADD COLUMN "webhookSecretCiphertext" TEXT;
