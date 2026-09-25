INSERT INTO "User" ("id", "email", "passwordHash", "isLodgeCoreAdmin", "updatedAt") 
VALUES (gen_random_uuid(), 'hq@lodgecore.com', '$2b$10$d7V908NCH04eAsk/oQQTzeZFfB6.2eHp.9Ozn3E7K94t58PKtC6E.', true, now())
ON CONFLICT ("email") DO UPDATE SET "isLodgeCoreAdmin" = true, "passwordHash" = '$2b$10$d7V908NCH04eAsk/oQQTzeZFfB6.2eHp.9Ozn3E7K94t58PKtC6E.';
