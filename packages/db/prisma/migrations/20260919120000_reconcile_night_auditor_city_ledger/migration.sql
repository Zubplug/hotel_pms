-- Reconcile existing Night Auditor roles that were created before the City
-- Ledger capability was granted. This intentionally does not depend on the
-- isSystem flag because property databases may have a copied role.

INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT role.id, permission.id
FROM "Role" role
CROSS JOIN "Permission" permission
WHERE REPLACE(UPPER(role.name), ' ', '_') = 'NIGHT_AUDITOR'
  AND permission.name = 'POST_CITY_LEDGER'
ON CONFLICT DO NOTHING;
