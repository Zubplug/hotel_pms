ALTER TABLE "StockItemUnit"
ADD COLUMN IF NOT EXISTS "purchaseCost" DECIMAL(18,2);

-- Preserve the existing meaning of StockItem.costPrice for old purchase-unit rows.
UPDATE "StockItemUnit"
SET "purchaseCost" = ROUND((s."costPrice" * "StockItemUnit"."unitsInBase")::numeric, 2)
FROM "StockItem" s
WHERE "StockItemUnit"."stockItemId" = s."id"
  AND "StockItemUnit"."isPurchaseUnit" = true
  AND "StockItemUnit"."purchaseCost" IS NULL;
