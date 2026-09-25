-- Corporate account capabilities. Idempotent and safe for production deployment.
INSERT INTO "Permission" (id, name, resource, action, description, "riskLevel", "isSystem", "requiresApproval")
VALUES
  (gen_random_uuid(), 'corporate_account:view', 'corporate_account', 'VIEW', 'View corporate accounts', 'LOW', true, false),
  (gen_random_uuid(), 'corporate_account:create', 'corporate_account', 'CREATE', 'Create corporate accounts', 'MEDIUM', true, false),
  (gen_random_uuid(), 'corporate_account:edit', 'corporate_account', 'EDIT', 'Edit corporate account profile data', 'MEDIUM', true, false),
  (gen_random_uuid(), 'corporate_account:change_credit_limit', 'corporate_account', 'CHANGE_CREDIT_LIMIT', 'Change corporate credit limits', 'HIGH', true, true),
  (gen_random_uuid(), 'corporate_account:change_deposit_policy', 'corporate_account', 'CHANGE_DEPOSIT_POLICY', 'Change corporate deposit policies', 'HIGH', true, true),
  (gen_random_uuid(), 'corporate_account:deactivate', 'corporate_account', 'DEACTIVATE', 'Deactivate corporate accounts', 'HIGH', true, true),
  (gen_random_uuid(), 'corporate_account:view_city_ledger', 'corporate_account', 'VIEW_CITY_LEDGER', 'View the linked City Ledger account', 'MEDIUM', true, false)
ON CONFLICT (name) DO UPDATE SET
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  "riskLevel" = EXCLUDED."riskLevel",
  "isSystem" = EXCLUDED."isSystem",
  "requiresApproval" = EXCLUDED."requiresApproval";

-- View-only roles.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."isSystem" = true
  AND r.name IN ('NIGHT_AUDITOR', 'GENERAL_CASHIER')
  AND p.name IN ('corporate_account:view', 'corporate_account:view_city_ledger')
ON CONFLICT DO NOTHING;

-- Admin may maintain profile data but not financial controls.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."isSystem" = true
  AND r.name = 'ADMIN'
  AND p.name IN ('corporate_account:view', 'corporate_account:create', 'corporate_account:edit', 'corporate_account:view_city_ledger')
ON CONFLICT DO NOTHING;

-- Accountant and management roles may maintain financial controls.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."isSystem" = true
  AND r.name IN ('ACCOUNTANT', 'GENERAL_MANAGER')
  AND p.name IN ('corporate_account:view', 'corporate_account:create', 'corporate_account:edit',
                 'corporate_account:change_credit_limit', 'corporate_account:change_deposit_policy',
                 'corporate_account:deactivate', 'corporate_account:view_city_ledger')
ON CONFLICT DO NOTHING;
