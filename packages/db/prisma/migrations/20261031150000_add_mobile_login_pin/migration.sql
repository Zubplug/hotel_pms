ALTER TABLE "User"
    ADD COLUMN IF NOT EXISTS "mobilePinHash" TEXT,
    ADD COLUMN IF NOT EXISTS "mobilePinFailedAttempts" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS "mobilePinLockedUntil" TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS "mobilePinSetAt" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "User_mobilePinLockedUntil_idx"
    ON "User"("mobilePinLockedUntil");
