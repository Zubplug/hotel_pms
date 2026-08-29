ALTER TABLE "PosProductModifier" ADD COLUMN IF NOT EXISTS "stockItemId" UUID;
ALTER TABLE "PosProductModifier" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(18,4) NOT NULL DEFAULT 1;
ALTER TABLE "PosProductModifier" ADD COLUMN IF NOT EXISTS "unitOfMeasure" "UnitOfMeasure";
ALTER TABLE "PosOrderItemModifier" ADD COLUMN IF NOT EXISTS "stockItemId" UUID;
ALTER TABLE "PosOrderItemModifier" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(18,4) NOT NULL DEFAULT 0;
ALTER TABLE "PosOrderItemModifier" ADD COLUMN IF NOT EXISTS "unitOfMeasure" "UnitOfMeasure";
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'PosProductModifier_stockItemId_fkey'
  ) THEN
    ALTER TABLE "PosProductModifier"
      ADD CONSTRAINT "PosProductModifier_stockItemId_fkey"
      FOREIGN KEY ("stockItemId") REFERENCES "StockItem"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "PosProductModifier_stockItemId_idx" ON "PosProductModifier"("stockItemId");
