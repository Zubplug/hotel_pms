-- Add rate plan permissions
INSERT INTO "Permission" (id, name, resource, action, description, "riskLevel", "isSystem", "requiresApproval")
VALUES
  (gen_random_uuid(), 'rate_plan:view', 'rate_plan', 'VIEW', 'View rate plans', 'LOW', true, false),
  (gen_random_uuid(), 'rate_plan:create', 'rate_plan', 'CREATE', 'Create rate plans', 'MEDIUM', true, false),
  (gen_random_uuid(), 'rate_plan:edit', 'rate_plan', 'EDIT', 'Edit rate plans', 'MEDIUM', true, false)
ON CONFLICT (name) DO UPDATE SET
  resource = EXCLUDED.resource,
  action = EXCLUDED.action,
  description = EXCLUDED.description,
  "riskLevel" = EXCLUDED."riskLevel",
  "isSystem" = EXCLUDED."isSystem",
  "requiresApproval" = EXCLUDED."requiresApproval";

-- Accountant and management roles may maintain rate plans.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r CROSS JOIN "Permission" p
WHERE r."isSystem" = true
  AND r.name IN ('ACCOUNTANT', 'GENERAL_MANAGER', 'DIRECTOR', 'HOTEL_MANAGER', 'FRONT_DESK_MANAGER', 'ADMIN', 'SUPER_ADMIN')
  AND p.name IN ('rate_plan:view', 'rate_plan:create', 'rate_plan:edit')
ON CONFLICT DO NOTHING;
