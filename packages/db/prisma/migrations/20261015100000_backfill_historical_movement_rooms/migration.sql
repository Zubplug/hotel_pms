-- Restore room assignments for historical departure/cancellation snapshots.
-- Departures use checkOut = businessDate, and cancelled room assignments may
-- no longer have ACTIVE status, so both must be selected inclusively.
WITH room_data AS (
    SELECT DISTINCT ON (n."id")
        n."id",
        rm."number" AS "roomNumber",
        rt."name" AS "roomType"
    FROM "NightAuditMovementSnapshot" n
    JOIN "ReservationRoom" rr ON rr."reservationId" = n."reservationId"
    JOIN "Room" rm ON rm."id" = rr."roomId"
    LEFT JOIN "RoomType" rt ON rt."id" = rm."roomTypeId"
    WHERE rr."reservationId" = n."reservationId"
      AND rr."checkIn" <= n."businessDate"
      AND rr."checkOut" >= n."businessDate"
    ORDER BY n."id",
        CASE WHEN rr."status" = 'ACTIVE' THEN 0 ELSE 1 END,
        rr."updatedAt" DESC,
        rr."createdAt" DESC,
        rr."id" DESC
)
UPDATE "NightAuditMovementSnapshot" AS n
SET
    "roomNumber" = room_data."roomNumber",
    "roomType" = room_data."roomType"
FROM room_data
WHERE n."id" = room_data."id"
  AND n."roomNumber" IS NULL;
