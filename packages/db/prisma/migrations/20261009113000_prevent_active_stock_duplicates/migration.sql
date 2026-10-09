-- A warehouse must have one active stock definition per normalized name.
-- Historical/inactive records remain allowed for audit and transaction history.
CREATE UNIQUE INDEX IF NOT EXISTS "StockItem_active_warehouse_name_key"
  ON "StockItem"(
    "warehouseId",
    lower(regexp_replace(btrim("name"), '\s+', ' ', 'g'))
  )
  WHERE "isActive" = true;
