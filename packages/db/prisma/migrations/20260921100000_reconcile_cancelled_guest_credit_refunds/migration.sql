-- Reconcile cancellation refund approvals after unspent folio credits have
-- been transferred to the REFUND_OWED guest-credit workflow.
--
-- The financial transfer and GL journals for the three production records were
-- executed transactionally through CityLedgerAccountingService. This guard is
-- intentionally idempotent: it closes any orphan direct-refund workflow when
-- the corresponding cancellation already has a guest-refund liability entry.
UPDATE "RefundRequest" request
SET
  "status" = 'CANCELLED',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE request."category" = 'RESERVATION_CANCELLED'
  AND request."cityLedgerEntryId" IS NULL
  AND request."status" IN ('PENDING_APPROVAL', 'APPROVED', 'PROCESSING')
  AND EXISTS (
    SELECT 1
    FROM "CityLedgerEntry" entry
    WHERE entry."reservationId" = request."reservationId"
      AND entry."folioId" = request."folioId"
      AND entry."type" = 'REFUND_OWED'
      AND entry."status" IN ('OPEN', 'SETTLED')
  );

UPDATE "ApprovalRequest" approval
SET
  "status" = 'CANCELLED',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE approval."type" = 'REFUND'
  AND approval."status" = 'PENDING'
  AND EXISTS (
    SELECT 1
    FROM "RefundRequest" request
    WHERE request."status" = 'CANCELLED'
      AND request."category" = 'RESERVATION_CANCELLED'
      AND (approval."details" ->> 'refundRequestId') = request."id"::text
  );
