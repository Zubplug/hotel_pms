-- Payment and refund accounting dates are mandatory after the historical
-- backfill. New financial records must not silently fall back to createdAt.
ALTER TABLE "Payment" ALTER COLUMN "businessDate" SET NOT NULL;
ALTER TABLE "Refund" ALTER COLUMN "businessDate" SET NOT NULL;
