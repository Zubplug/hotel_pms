-- OTA integration actor bootstrap
--
-- Run this script against production. It is safe to run repeatedly.
--
-- Each organization receives a distinct actor because the current schema
-- enforces one OrganizationMembership per user. Actor email is derived from
-- the immutable organization slug and is used by the OTA service.

BEGIN;

INSERT INTO "User" ("id", "email", "passwordHash", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  'system+' || o."slug" || '@lodgecore.internal',
  'NO_LOGIN_SYSTEM_ACCOUNT',
  now(),
  now()
FROM "Organization" o
ON CONFLICT ("email") DO NOTHING;

INSERT INTO "OrganizationMembership" (
  "id", "userId", "organizationId", "role", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid(),
  u."id",
  o."id",
  'ADMIN',
  now(),
  now()
FROM "Organization" o
JOIN "User" u
  ON u."email" = 'system+' || o."slug" || '@lodgecore.internal'
ON CONFLICT ("userId") DO NOTHING;

COMMIT;
