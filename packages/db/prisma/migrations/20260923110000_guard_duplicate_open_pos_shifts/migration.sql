-- Prevent concurrent terminals from creating duplicate active POS shifts.
-- Legacy rows with a NULL controlStatus are treated as open by the application.
CREATE UNIQUE INDEX "PosSession_one_open_server_shift_per_operator"
ON "PosSession" ("propertyId", "outletId", "primaryOperatorId", "businessDate", "bankType")
WHERE "bankType" = 'SERVER'
  AND "primaryOperatorId" IS NOT NULL
  AND "status" = 'OPEN'
  AND ("controlStatus" IS NULL OR "controlStatus" = 'OPEN');

CREATE UNIQUE INDEX "PosSession_one_open_central_shift_per_outlet"
ON "PosSession" ("propertyId", "outletId", "businessDate", "bankType", "bankingModel")
WHERE "bankType" = 'CENTRAL'
  AND "bankingModel" = 'CENTRAL_CASHIER'
  AND "status" = 'OPEN'
  AND ("controlStatus" IS NULL OR "controlStatus" = 'OPEN');
