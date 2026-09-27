-- Lease occurrence times were originally written with Date.UTC even though
-- the lease form captures venue-local wall-clock times. Reinterpret those
-- legacy UTC wall-clock values in each property's timezone.
UPDATE "EventBooking" eb
SET
  "startTime" = (eb."startTime" AT TIME ZONE 'UTC') AT TIME ZONE p."timezone",
  "endTime" = (eb."endTime" AT TIME ZONE 'UTC') AT TIME ZONE p."timezone"
FROM "LeaseContract" lc
JOIN "Property" p ON p."id" = lc."propertyId"
WHERE lc."eventId" = eb."eventId"
  AND lc."eventId" IS NOT NULL;

UPDATE "Event" e
SET
  "startDate" = (e."startDate" AT TIME ZONE 'UTC') AT TIME ZONE p."timezone",
  "endDate" = (e."endDate" AT TIME ZONE 'UTC') AT TIME ZONE p."timezone"
FROM "LeaseContract" lc
JOIN "Property" p ON p."id" = lc."propertyId"
WHERE lc."eventId" = e."id"
  AND lc."eventId" IS NOT NULL;
