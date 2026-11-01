ALTER TABLE "PasswordResetToken"
    ADD COLUMN IF NOT EXISTS "purpose" TEXT NOT NULL DEFAULT 'PASSWORD',
    ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "PasswordResetToken_purpose_idx"
    ON "PasswordResetToken"("purpose");
