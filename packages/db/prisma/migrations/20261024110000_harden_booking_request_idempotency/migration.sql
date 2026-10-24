ALTER TABLE "BookingRequest"
    ADD COLUMN "principalId" TEXT,
    ADD COLUMN "operation" TEXT,
    ADD COLUMN "requestFingerprint" TEXT;

CREATE INDEX "BookingRequest_principalId_propertyId_operation_createdAt_idx"
    ON "BookingRequest"("principalId", "propertyId", "operation", "createdAt");
