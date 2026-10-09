ALTER TABLE "CustomWebsiteRequest"
  ADD COLUMN IF NOT EXISTS "developmentMode" TEXT NOT NULL DEFAULT 'PMS_CONNECTED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CustomWebsiteRequest_developmentMode_check'
      AND conrelid = '"CustomWebsiteRequest"'::regclass
  ) THEN
    ALTER TABLE "CustomWebsiteRequest"
      ADD CONSTRAINT "CustomWebsiteRequest_developmentMode_check"
      CHECK ("developmentMode" IN ('STANDALONE_API', 'PMS_CONNECTED'));
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS "CustomWebsiteRequest_property_mode_idx"
  ON "CustomWebsiteRequest"("propertyId", "developmentMode");
