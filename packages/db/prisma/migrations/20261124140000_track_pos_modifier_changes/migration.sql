-- Keep POS product projections fresh when a modifier changes independently.
-- Without this, an offline terminal can retain a modifier that is no longer
-- active in the cloud until the next full provisioning sync.
ALTER TABLE "PosProductModifier"
    ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE OR REPLACE FUNCTION "touch_pos_product_from_modifier"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE "PosProduct" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = OLD."productId";
        RETURN OLD;
    END IF;

    UPDATE "PosProduct" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = NEW."productId";
    IF TG_OP = 'UPDATE' AND OLD."productId" IS DISTINCT FROM NEW."productId" THEN
        UPDATE "PosProduct" SET "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = OLD."productId";
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "PosProductModifier_touch_product_updatedAt"
    ON "PosProductModifier";

CREATE TRIGGER "PosProductModifier_touch_product_updatedAt"
AFTER INSERT OR UPDATE OR DELETE ON "PosProductModifier"
FOR EACH ROW
EXECUTE FUNCTION "touch_pos_product_from_modifier"();
