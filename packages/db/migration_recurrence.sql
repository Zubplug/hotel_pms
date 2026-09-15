-- Add recurrenceRule to Event
ALTER TABLE "Event" 
ADD COLUMN "recurrenceRule" JSONB;

-- Add status, isException, and cancellationReason to EventBooking
ALTER TABLE "EventBooking" 
ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "isException" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "cancellationReason" TEXT;
