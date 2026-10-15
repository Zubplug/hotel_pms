ALTER TABLE "OccupancySnapshot"
ADD COLUMN "outOfServiceRooms" INTEGER NOT NULL DEFAULT 0;

UPDATE "OccupancySnapshot"
SET "availableRooms" = GREATEST(
    0,
    "totalRooms" - "occupiedRooms" - "outOfOrderRooms" - "outOfServiceRooms" - "blockedRooms"
);

CREATE TABLE "NightAuditMovementSnapshot" (
    "id" UUID NOT NULL,
    "nightAuditId" UUID NOT NULL,
    "propertyId" UUID NOT NULL,
    "businessDate" DATE NOT NULL,
    "reservationId" UUID NOT NULL,
    "movementType" TEXT NOT NULL,
    "confirmationNumber" TEXT NOT NULL,
    "guestName" TEXT NOT NULL,
    "roomNumber" TEXT,
    "roomType" TEXT,
    "source" TEXT,
    "status" TEXT NOT NULL,
    "adults" INTEGER NOT NULL,
    "children" INTEGER NOT NULL,
    "folioBalance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "capturedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "NightAuditMovementSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NightAuditMovementSnapshot_nightAuditId_reservationId_movementType_key"
ON "NightAuditMovementSnapshot"("nightAuditId", "reservationId", "movementType");

CREATE INDEX "NightAuditMovementSnapshot_propertyId_businessDate_movementType_idx"
ON "NightAuditMovementSnapshot"("propertyId", "businessDate", "movementType");

ALTER TABLE "NightAuditMovementSnapshot"
ADD CONSTRAINT "NightAuditMovementSnapshot_nightAuditId_fkey"
FOREIGN KEY ("nightAuditId") REFERENCES "NightAudit"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NightAuditMovementSnapshot"
ADD CONSTRAINT "NightAuditMovementSnapshot_propertyId_fkey"
FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "NightAuditMovementSnapshot"
ADD CONSTRAINT "NightAuditMovementSnapshot_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill completed audits from the reservation audit trail. The latest
-- reservation status at audit completion is used, so later check-outs or
-- cancellations cannot rewrite a historical movement report.
WITH audit_reservations AS (
    SELECT
        na."id" AS "nightAuditId",
        na."propertyId",
        na."businessDate",
        na."completedAt",
        r."id" AS "reservationId",
        r."confirmationNumber",
        r."source"::text AS "source",
        COALESCE(status_event."status", r."status"::text) AS "status",
        r."checkIn",
        r."checkOut",
        r."adults",
        r."children",
        CONCAT_WS(' ', g."firstName", g."lastName") AS "guestName",
        room_data."roomNumber",
        room_data."roomType",
        COALESCE(folio_data."folioBalance", 0) AS "folioBalance",
        COALESCE(na."completedAt", na."cutoffAt", na."createdAt") AS "capturedAt"
    FROM "NightAudit" na
    JOIN "Reservation" r
      ON r."propertyId" = na."propertyId"
     AND (r."checkIn" = na."businessDate" OR r."checkOut" = na."businessDate")
    LEFT JOIN "Guest" g ON g."id" = r."primaryGuestId"
    LEFT JOIN LATERAL (
        SELECT (al."newValue" ->> 'status') AS "status"
        FROM "AuditLog" al
        WHERE al."propertyId" = na."propertyId"
          AND al."resource" = 'Reservation'
          AND al."resourceId" = r."id"::text
          AND al."action" IN (
              'RESERVATION_CHECKED_IN',
              'RESERVATION_CHECKED_OUT',
              'RESERVATION_CHECKED_OUT_CREDIT_TRANSFERRED',
              'RESERVATION_CHECKED_OUT_CREDIT_RETAINED',
              'RESERVATION_CANCELLED',
              'RESERVATION_NO_SHOW_ASSESSED'
          )
          AND al."createdAt" <= COALESCE(na."completedAt", na."cutoffAt", na."createdAt")
        ORDER BY al."createdAt" DESC
        LIMIT 1
    ) status_event ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            rm."number" AS "roomNumber",
            rt."name" AS "roomType"
        FROM "ReservationRoom" rr
        JOIN "Room" rm ON rm."id" = rr."roomId"
        LEFT JOIN "RoomType" rt ON rt."id" = rm."roomTypeId"
        WHERE rr."reservationId" = r."id"
          AND rr."status" = 'ACTIVE'
          AND rr."checkIn" <= na."businessDate"
          AND rr."checkOut" > na."businessDate"
        ORDER BY rr."updatedAt" DESC, rr."createdAt" DESC, rr."id" DESC
        LIMIT 1
    ) room_data ON TRUE
    LEFT JOIN LATERAL (
        SELECT SUM(f."balance") AS "folioBalance"
        FROM "Folio" f
        WHERE f."reservationId" = r."id"
    ) folio_data ON TRUE
    WHERE na."status" = 'COMPLETED'
), movement_rows AS (
    SELECT *, 'CANCELLATION' AS "movementType"
    FROM audit_reservations
    WHERE "status" = 'CANCELLED'
    UNION ALL
    SELECT *, 'ARRIVAL' AS "movementType"
    FROM audit_reservations
    WHERE "status" <> 'CANCELLED' AND "checkIn" = "businessDate"
    UNION ALL
    SELECT *, 'DEPARTURE' AS "movementType"
    FROM audit_reservations
    WHERE "status" <> 'CANCELLED' AND "checkOut" = "businessDate"
)
INSERT INTO "NightAuditMovementSnapshot" (
    "id", "nightAuditId", "propertyId", "businessDate", "reservationId",
    "movementType", "confirmationNumber", "guestName", "roomNumber", "roomType",
    "source", "status", "adults", "children", "folioBalance", "capturedAt"
)
SELECT
    gen_random_uuid(), "nightAuditId", "propertyId", "businessDate", "reservationId",
    "movementType", "confirmationNumber", "guestName", "roomNumber", "roomType",
    "source", "status", "adults", "children", "folioBalance", "capturedAt"
FROM movement_rows
ON CONFLICT ("nightAuditId", "reservationId", "movementType") DO NOTHING;
