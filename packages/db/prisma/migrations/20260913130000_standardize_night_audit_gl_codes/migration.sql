-- Normalize legacy property-specific codes to the canonical Night Audit chart.
-- Account IDs and all journal history are preserved; only the code changes.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "ChartOfAccount" legacy
    WHERE legacy."code" = '4000'
      AND EXISTS (
        SELECT 1 FROM "ChartOfAccount" target
        WHERE target."propertyId" = legacy."propertyId" AND target."code" = '4050'
      )
  ) THEN
    RAISE EXCEPTION 'Cannot normalize Room Revenue: both codes 4000 and 4050 exist for a property';
  END IF;

  UPDATE "ChartOfAccount"
  SET "code" = '4050', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "code" = '4000' AND "name" ILIKE '%room revenue%'
    AND NOT EXISTS (
      SELECT 1 FROM "ChartOfAccount" target
      WHERE target."propertyId" = "ChartOfAccount"."propertyId"
        AND target."code" = '4050'
    );

  IF EXISTS (
    SELECT 1 FROM "ChartOfAccount" legacy
    WHERE legacy."code" = '1200'
      AND EXISTS (
        SELECT 1 FROM "ChartOfAccount" target
        WHERE target."propertyId" = legacy."propertyId" AND target."code" = '1140'
      )
  ) THEN
    RAISE EXCEPTION 'Cannot normalize City Ledger: both codes 1200 and 1140 exist for a property';
  END IF;

  UPDATE "ChartOfAccount"
  SET "code" = '1140', "updatedAt" = CURRENT_TIMESTAMP
  WHERE "code" = '1200' AND "name" ILIKE '%city ledger%'
    AND NOT EXISTS (
      SELECT 1 FROM "ChartOfAccount" target
      WHERE target."propertyId" = "ChartOfAccount"."propertyId"
        AND target."code" = '1140'
    );
END $$;
