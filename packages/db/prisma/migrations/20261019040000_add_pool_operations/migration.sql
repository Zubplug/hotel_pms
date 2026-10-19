CREATE TABLE "PoolFacility" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "capacity" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolFacility_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PoolFacility_propertyId_code_key" ON "PoolFacility"("propertyId", "code");
CREATE INDEX "PoolFacility_propertyId_isActive_idx" ON "PoolFacility"("propertyId", "isActive");
ALTER TABLE "PoolFacility" ADD CONSTRAINT "PoolFacility_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PoolPassType" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "productId" UUID,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "guestClass" TEXT NOT NULL DEFAULT 'ADULT',
  "price" DECIMAL(18,4) NOT NULL DEFAULT 0,
  "currency" TEXT NOT NULL DEFAULT 'NGN',
  "maxDuration" INTEGER NOT NULL DEFAULT 480,
  "isComplimentary" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolPassType_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PoolPassType_propertyId_code_key" ON "PoolPassType"("propertyId", "code");
CREATE INDEX "PoolPassType_facilityId_isActive_idx" ON "PoolPassType"("facilityId", "isActive");
ALTER TABLE "PoolPassType" ADD CONSTRAINT "PoolPassType_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolPassType" ADD CONSTRAINT "PoolPassType_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "PoolFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PoolEntry" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "passTypeId" UUID NOT NULL,
  "guestId" UUID,
  "reservationId" UUID,
  "folioId" UUID,
  "posOrderId" UUID,
  "entryNumber" TEXT NOT NULL,
  "identifier" TEXT,
  "status" TEXT NOT NULL DEFAULT 'RESERVED',
  "entryDate" DATE NOT NULL,
  "admittedAt" TIMESTAMPTZ,
  "exitedAt" TIMESTAMPTZ,
  "guestCount" INTEGER NOT NULL DEFAULT 1,
  "waiverAccepted" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdBy" UUID,
  "checkedInBy" UUID,
  "checkedOutBy" UUID,
  "operationId" TEXT,
  "deviceId" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolEntry_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PoolEntry_entryNumber_key" ON "PoolEntry"("entryNumber");
CREATE UNIQUE INDEX "PoolEntry_operationId_key" ON "PoolEntry"("operationId");
CREATE INDEX "PoolEntry_propertyId_entryDate_status_idx" ON "PoolEntry"("propertyId", "entryDate", "status");
CREATE INDEX "PoolEntry_facilityId_entryDate_status_idx" ON "PoolEntry"("facilityId", "entryDate", "status");
CREATE INDEX "PoolEntry_identifier_status_idx" ON "PoolEntry"("identifier", "status");
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "PoolFacility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_passTypeId_fkey" FOREIGN KEY ("passTypeId") REFERENCES "PoolPassType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_folioId_fkey" FOREIGN KEY ("folioId") REFERENCES "Folio"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PoolEntry" ADD CONSTRAINT "PoolEntry_posOrderId_fkey" FOREIGN KEY ("posOrderId") REFERENCES "PosOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PoolResource" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolResource_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PoolResource_propertyId_code_key" ON "PoolResource"("propertyId", "code");
CREATE INDEX "PoolResource_facilityId_type_status_idx" ON "PoolResource"("facilityId", "type", "status");
ALTER TABLE "PoolResource" ADD CONSTRAINT "PoolResource_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolResource" ADD CONSTRAINT "PoolResource_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "PoolFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PoolResourceBooking" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "resourceId" UUID NOT NULL,
  "entryId" UUID,
  "startAt" TIMESTAMPTZ NOT NULL,
  "endAt" TIMESTAMPTZ NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'BOOKED',
  "notes" TEXT,
  "createdBy" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolResourceBooking_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PoolResourceBooking_propertyId_startAt_endAt_idx" ON "PoolResourceBooking"("propertyId", "startAt", "endAt");
CREATE INDEX "PoolResourceBooking_resourceId_startAt_endAt_idx" ON "PoolResourceBooking"("resourceId", "startAt", "endAt");
ALTER TABLE "PoolResourceBooking" ADD CONSTRAINT "PoolResourceBooking_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolResourceBooking" ADD CONSTRAINT "PoolResourceBooking_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "PoolResource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PoolResourceBooking" ADD CONSTRAINT "PoolResourceBooking_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PoolEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "PoolSafetyCheck" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "checkType" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PASS',
  "chlorine" DECIMAL(8,3),
  "ph" DECIMAL(8,3),
  "notes" TEXT,
  "checkedBy" UUID,
  "checkedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolSafetyCheck_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PoolSafetyCheck_propertyId_checkedAt_idx" ON "PoolSafetyCheck"("propertyId", "checkedAt");
CREATE INDEX "PoolSafetyCheck_facilityId_checkType_checkedAt_idx" ON "PoolSafetyCheck"("facilityId", "checkType", "checkedAt");
ALTER TABLE "PoolSafetyCheck" ADD CONSTRAINT "PoolSafetyCheck_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolSafetyCheck" ADD CONSTRAINT "PoolSafetyCheck_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "PoolFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "PoolIncident" (
  "id" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "facilityId" UUID NOT NULL,
  "entryId" UUID,
  "severity" TEXT NOT NULL DEFAULT 'LOW',
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "resolvedAt" TIMESTAMPTZ,
  "createdBy" UUID,
  "resolvedBy" UUID,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PoolIncident_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "PoolIncident_propertyId_status_severity_idx" ON "PoolIncident"("propertyId", "status", "severity");
CREATE INDEX "PoolIncident_facilityId_createdAt_idx" ON "PoolIncident"("facilityId", "createdAt");
ALTER TABLE "PoolIncident" ADD CONSTRAINT "PoolIncident_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolIncident" ADD CONSTRAINT "PoolIncident_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "PoolFacility"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PoolIncident" ADD CONSTRAINT "PoolIncident_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "PoolEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
