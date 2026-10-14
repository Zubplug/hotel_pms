BEGIN;

CREATE TABLE "AttendanceGeofence" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "propertyId" UUID NOT NULL,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "radiusMeters" INTEGER NOT NULL DEFAULT 150,
  "minAccuracyMeters" INTEGER NOT NULL DEFAULT 100,
  "isEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdBy" UUID NOT NULL,
  "updatedBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL,
  CONSTRAINT "AttendanceGeofence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendanceGeofence_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AttendanceGeofence_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AttendanceGeofence_propertyId_key" ON "AttendanceGeofence"("propertyId");
CREATE INDEX "AttendanceGeofence_organizationId_idx" ON "AttendanceGeofence"("organizationId");

ALTER TABLE "AttendanceRecord"
  ADD COLUMN IF NOT EXISTS "locationStatus" TEXT;

CREATE TABLE "AttendancePunch" (
  "id" UUID NOT NULL,
  "attendanceRecordId" UUID NOT NULL,
  "action" TEXT NOT NULL,
  "punchedAt" TIMESTAMPTZ NOT NULL,
  "latitude" DECIMAL(10,7),
  "longitude" DECIMAL(10,7),
  "accuracyMeters" DECIMAL(8,2),
  "distanceMeters" DECIMAL(8,2),
  "locationStatus" TEXT NOT NULL,
  "punchSource" TEXT NOT NULL,
  "recordedBy" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendancePunch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AttendancePunch_attendanceRecordId_fkey" FOREIGN KEY ("attendanceRecordId") REFERENCES "AttendanceRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "AttendancePunch_attendanceRecordId_punchedAt_idx" ON "AttendancePunch"("attendanceRecordId", "punchedAt");

COMMIT;
