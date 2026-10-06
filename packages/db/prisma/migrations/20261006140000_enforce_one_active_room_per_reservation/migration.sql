-- LodgeCore reservations have one active physical room. Preserve older room
-- assignments for audit, but normalize duplicate active assignments before the
-- partial unique index is created.
WITH ranked_active_assignments AS (
    SELECT
        id,
        "reservationId",
        "roomId",
        ROW_NUMBER() OVER (
            PARTITION BY "reservationId"
            ORDER BY "updatedAt" DESC, "createdAt" DESC, id DESC
        ) AS assignment_rank
    FROM "ReservationRoom"
    WHERE "status" = 'ACTIVE'
), duplicate_assignments AS (
    SELECT id
    FROM ranked_active_assignments
    WHERE assignment_rank > 1
), updated_assignments AS (
    UPDATE "ReservationRoom" AS assignment
    SET "status" = 'INACTIVE', "updatedAt" = CURRENT_TIMESTAMP
    FROM duplicate_assignments AS duplicate
    WHERE assignment.id = duplicate.id
    RETURNING assignment."roomId", assignment."reservationId"
)
-- Release rooms orphaned by the normalization. Checked-in reservations require
-- housekeeping; future reservations return the room to available inventory.
UPDATE "Room" AS room
SET
    "status" = CASE
        WHEN EXISTS (
            SELECT 1 FROM "ReservationRoom" active_assignment
            JOIN "Reservation" active_reservation ON active_reservation.id = active_assignment."reservationId"
            WHERE active_assignment."roomId" = room.id
              AND active_assignment."status" = 'ACTIVE'
              AND active_reservation."status" NOT IN ('CHECKED_OUT', 'CANCELLED', 'NO_SHOW')
        ) THEN room."status"
        WHEN EXISTS (
            SELECT 1
            FROM updated_assignments duplicate
            JOIN "Reservation" checked_in_reservation
              ON checked_in_reservation.id = duplicate."reservationId"
            WHERE duplicate."roomId" = room.id
              AND checked_in_reservation."status" = 'CHECKED_IN'
        ) THEN 'DIRTY'
        ELSE 'AVAILABLE'
    END,
    "housekeepingStatus" = CASE
        WHEN EXISTS (
            SELECT 1
            FROM updated_assignments duplicate
            JOIN "Reservation" checked_in_reservation
              ON checked_in_reservation.id = duplicate."reservationId"
            WHERE duplicate."roomId" = room.id
              AND checked_in_reservation."status" = 'CHECKED_IN'
        ) THEN 'CLEANING'
        ELSE "housekeepingStatus"
    END,
    "updatedAt" = CURRENT_TIMESTAMP
WHERE room.id IN (SELECT "roomId" FROM updated_assignments WHERE "roomId" IS NOT NULL);

CREATE UNIQUE INDEX "ReservationRoom_one_active_per_reservation"
ON "ReservationRoom" ("reservationId")
WHERE "status" = 'ACTIVE';
