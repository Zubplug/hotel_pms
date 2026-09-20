-- Front desk shifts must use a dedicated FRONTDESK_TILL. Cash in Transit is a
-- General Cashier control account and must never be offered to offline tills.
-- Reassign only when an unused active till is available; unresolved rows are
-- intentionally left visible for controlled property-level repair.
WITH bad_sessions AS (
  SELECT
    session."id" AS "sessionId",
    session."propertyId",
    ROW_NUMBER() OVER (PARTITION BY session."propertyId" ORDER BY session."openedAt", session."id") AS "row_no"
  FROM "FrontdeskSession" session
  JOIN "CashAccount" current_account
    ON current_account."id" = session."cashAccountId"
   AND current_account."type" = 'CASH_IN_TRANSIT'
), available_tills AS (
  SELECT
    till."id" AS "tillId",
    till."propertyId",
    ROW_NUMBER() OVER (PARTITION BY till."propertyId" ORDER BY till."name", till."id") AS "row_no"
  FROM "CashAccount" till
  WHERE till."type" = 'FRONTDESK_TILL'
    AND till."isActive" = true
    AND NOT EXISTS (
      SELECT 1
      FROM "FrontdeskSession" other_session
      WHERE other_session."cashAccountId" = till."id"
        AND other_session."status" IN ('OPEN', 'CLOSING')
        AND other_session."controlStatus" = 'OPEN'
    )
), repairable AS (
  SELECT bad_sessions."sessionId", available_tills."tillId"
  FROM bad_sessions
  JOIN available_tills
    ON available_tills."propertyId" = bad_sessions."propertyId"
   AND available_tills."row_no" = bad_sessions."row_no"
)
UPDATE "FrontdeskSession" session
SET "cashAccountId" = repairable."tillId",
    "updatedAt" = CURRENT_TIMESTAMP
FROM repairable
WHERE repairable."sessionId" = session."id"
;
