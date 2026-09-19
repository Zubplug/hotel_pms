-- Night Auditors resolve departure exceptions in the audit wizard, including
-- controlled transfers of guest folio balances to City Ledger.
-- Idempotent and limited to the system NIGHT_AUDITOR role.

INSERT INTO "Permission" (
  id,
  name,
  resource,
  action,
  description,
  "riskLevel",
  "isSystem",
  "requiresApproval"
)
VALUES (
  gen_random_uuid(),
  'POST_CITY_LEDGER',
  'LEDGER',
  'CREATE',
  'Post controlled guest and corporate balances to City Ledger',
  'HIGH',
  true,
  true
)
ON CONFLICT (name) DO UPDATE SET
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  "riskLevel" = EXCLUDED."riskLevel",
  "isSystem" = EXCLUDED."isSystem",
  "requiresApproval" = EXCLUDED."requiresApproval";

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role.id, permission.id
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE role.name = 'NIGHT_AUDITOR'
  AND role."isSystem" = true
  AND permission.name = 'POST_CITY_LEDGER'
ON CONFLICT DO NOTHING;
