-- Conversation history for employee HR service requests.
BEGIN;

CREATE TABLE IF NOT EXISTS "HrServiceDeskMessage" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "ticketId" UUID NOT NULL REFERENCES "HrServiceDeskTicket"("id") ON DELETE CASCADE,
  "authorId" UUID NOT NULL,
  "body" TEXT NOT NULL,
  "isInternal" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "HrServiceDeskMessage_ticketId_createdAt_idx"
  ON "HrServiceDeskMessage"("ticketId", "createdAt");

COMMIT;
