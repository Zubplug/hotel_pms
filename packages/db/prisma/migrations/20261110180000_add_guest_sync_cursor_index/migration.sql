-- Guest delta sync reads one property in updatedAt/id cursor order.
-- Keep this composite index aligned with /api/v1/sync/guests.
CREATE INDEX "Guest_propertyId_updatedAt_id_idx"
ON "Guest"("propertyId", "updatedAt", "id");
