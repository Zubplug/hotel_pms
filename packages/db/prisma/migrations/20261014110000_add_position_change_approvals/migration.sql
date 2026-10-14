CREATE TABLE "PositionChangeRequest" (
    "id" UUID NOT NULL,
    "positionId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "requestedById" UUID NOT NULL,
    "reviewedById" UUID,
    "proposedMinSalary" DECIMAL(18,4),
    "proposedMaxSalary" DECIMAL(18,4),
    "proposedHeadcount" INTEGER NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewNotes" TEXT,
    "reviewedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "PositionChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PositionChangeRequest_positionId_status_idx" ON "PositionChangeRequest"("positionId", "status");
CREATE INDEX "PositionChangeRequest_propertyId_status_createdAt_idx" ON "PositionChangeRequest"("propertyId", "status", "createdAt");

ALTER TABLE "PositionChangeRequest"
    ADD CONSTRAINT "PositionChangeRequest_positionId_fkey"
    FOREIGN KEY ("positionId") REFERENCES "JobPosition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PositionChangeRequest"
    ADD CONSTRAINT "PositionChangeRequest_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PositionChangeRequest"
    ADD CONSTRAINT "PositionChangeRequest_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PositionChangeRequest"
    ADD CONSTRAINT "PositionChangeRequest_reviewedById_fkey"
    FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
