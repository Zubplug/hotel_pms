-- Migration: add_night_audit_permission
-- Purpose: Adds the dedicated night_audit:execute permission to replace the
--          incorrectly-used housekeeping:create permission for night audit execution.
-- Strategy: Fully idempotent — safe to re-run.

-- Step 1: Create the permission if it doesn't exist
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
  'night_audit:execute',
  'night_audit',
  'execute',
  'Allows executing the nightly business date rollover, posting room charges, and generating housekeeping tasks.',
  'HIGH',
  true,
  false
)
ON CONFLICT (name) DO NOTHING;

-- Step 2: Grant the permission to all Roles whose name indicates management authority.
-- This covers system-seeded roles. Property-specific roles should be updated via the UI.
-- We only insert where the role is a system role to avoid touching custom property roles.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE p.name = 'night_audit:execute'
  AND r."isSystem" = true
  AND r.name IN (
    'SUPER_ADMIN',
    'MANAGER',
    'HOTEL_MANAGER',
    'NIGHT_AUDITOR',
    'FRONT_DESK_MANAGER'
  )
ON CONFLICT DO NOTHING;
