ALTER TABLE "NoShowPolicy"
  ADD COLUMN "cutoffTime" TEXT NOT NULL DEFAULT '02:00',
  ADD COLUMN "gracePeriodMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "refundableUnusedNights" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "allowReinstatement" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "reinstatementRequiresApproval" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "exceptionRequiresApproval" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Reservation"
  ADD COLUMN "lateArrivalExpected" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lateArrivalNotes" TEXT,
  ADD COLUMN "lateArrivalAt" TIMESTAMPTZ,
  ADD COLUMN "lateArrivalBy" UUID,
  ADD COLUMN "noShowAssessedAt" TIMESTAMPTZ,
  ADD COLUMN "noShowChargeAmount" DECIMAL(18,4),
  ADD COLUMN "noShowRefundableAmount" DECIMAL(18,4),
  ADD COLUMN "reinstatedAt" TIMESTAMPTZ,
  ADD COLUMN "reinstatedBy" UUID,
  ADD COLUMN "reinstatementReason" TEXT;
