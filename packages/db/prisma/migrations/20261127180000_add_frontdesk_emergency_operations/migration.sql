-- Durable emergency front-desk operation when the desktop terminal is unavailable.
-- Cloud reservation, room, folio, and audit state is completed immediately;
-- physical card work is reconciled by the desktop when it reconnects.
CREATE TABLE IF NOT EXISTS "FrontdeskEmergencyOperation" (
    "id" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "reservationId" UUID NOT NULL,
    "operationType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLOUD_COMPLETED_HARDWARE_PENDING',
    "idempotencyKey" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "requestedByUserId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "cardEncodingRequired" BOOLEAN NOT NULL DEFAULT false,
    "cardEncodingStatus" TEXT NOT NULL DEFAULT 'NOT_REQUIRED',
    "cardSerialNumber" TEXT,
    "desktopDeviceId" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "cloudCompletedAt" TIMESTAMPTZ,
    "hardwareReconciledAt" TIMESTAMPTZ,
    "processedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,
    CONSTRAINT "FrontdeskEmergencyOperation_pkey" PRIMARY KEY ("id")
);

-- Keep this migration safe if an earlier emergency-operation draft created the
-- table before the cloud-completion fields were added.
ALTER TABLE "FrontdeskEmergencyOperation"
  ADD COLUMN IF NOT EXISTS "cloudCompletedAt" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "hardwareReconciledAt" TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS "FrontdeskEmergencyOperation_idempotencyKey_key"
  ON "FrontdeskEmergencyOperation"("idempotencyKey");
CREATE INDEX IF NOT EXISTS "FrontdeskEmergencyOperation_propertyId_status_createdAt_idx"
  ON "FrontdeskEmergencyOperation"("propertyId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "FrontdeskEmergencyOperation_reservationId_operationType_status_idx"
  ON "FrontdeskEmergencyOperation"("reservationId", "operationType", "status");

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FrontdeskEmergencyOperation_propertyId_fkey') THEN
    ALTER TABLE "FrontdeskEmergencyOperation"
      ADD CONSTRAINT "FrontdeskEmergencyOperation_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FrontdeskEmergencyOperation_reservationId_fkey') THEN
    ALTER TABLE "FrontdeskEmergencyOperation"
      ADD CONSTRAINT "FrontdeskEmergencyOperation_reservationId_fkey"
      FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FrontdeskEmergencyOperation_requestedByUserId_fkey') THEN
    ALTER TABLE "FrontdeskEmergencyOperation"
      ADD CONSTRAINT "FrontdeskEmergencyOperation_requestedByUserId_fkey"
      FOREIGN KEY ("requestedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
