-- Front desk staff need read-only corporate profiles and negotiated rates when
-- creating reservations. Keep MODULE_OPERATIONS as the separate entitlement
-- guard and do not grant corporate-management or city-ledger permissions.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT r.id, p.id
FROM "Role" r
CROSS JOIN "Permission" p
WHERE r.name IN ('RECEPTIONIST', 'FRONT_DESK', 'FRONT_DESK_MANAGER')
  AND p.name = 'corporate_account:view'
ON CONFLICT DO NOTHING;

-- Some installations use custom role names for front-desk staff. Grant the
-- same read-only capability to any role that already has Front Desk access.
INSERT INTO "RolePermission" ("roleId", "permissionId")
SELECT front_desk_role."roleId", corporate_view."id"
FROM "RolePermission" front_desk_role
JOIN "Permission" front_desk_access
  ON front_desk_access."id" = front_desk_role."permissionId"
CROSS JOIN "Permission" corporate_view
WHERE front_desk_access."name" = 'ACCESS_FRONT_DESK'
  AND corporate_view."name" = 'corporate_account:view'
ON CONFLICT DO NOTHING;
