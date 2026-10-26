INSERT INTO "BillingProduct" ("id", "code", "name", "type", "active", "catalogVersion", "metadata", "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'ADDON_EXTRA_TERMINAL',
  'Additional POS Terminal',
  'ADDON',
  true,
  2,
  '{"family":"SCALE","unit":"TERMINAL","capacityKey":"maxTerminals","capacityAmount":1,"sellable":true,"offlineCapable":true,"requiresProducts":["MODULE_OPERATIONS"],"version":2}'::jsonb,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "active" = true,
  "catalogVersion" = 2,
  "metadata" = EXCLUDED."metadata",
  "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "BillingPrice" ("id", "productId", "amount", "currency", "interval", "catalogVersion", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", 1000000, 'ngn', 'month', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BillingProduct" p WHERE p."code" = 'ADDON_EXTRA_TERMINAL'
ON CONFLICT ("productId", "interval", "catalogVersion") DO UPDATE SET "amount" = 1000000, "currency" = 'ngn', "updatedAt" = CURRENT_TIMESTAMP;

INSERT INTO "BillingPrice" ("id", "productId", "amount", "currency", "interval", "catalogVersion", "createdAt", "updatedAt")
SELECT gen_random_uuid(), p."id", 10000000, 'ngn', 'year', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "BillingProduct" p WHERE p."code" = 'ADDON_EXTRA_TERMINAL'
ON CONFLICT ("productId", "interval", "catalogVersion") DO UPDATE SET "amount" = 10000000, "currency" = 'ngn', "updatedAt" = CURRENT_TIMESTAMP;
