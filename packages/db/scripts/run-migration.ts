import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sql = `
DO $$
DECLARE
    g RECORD;
    most_recent_prop UUID;
    target_prop UUID;
    new_guest_id UUID;
BEGIN
    FOR g IN 
        SELECT "id", "organizationId", "firstName", "lastName", "email", "phone", "dateOfBirth", "gender", "nationality", 
               "addressLine1", "addressLine2", "city", "state", "country", "idType", "idNumberEncrypted", "idNumberHint", 
               "companyName", "companyId", "isVip", "vipLevel", "preferences", "notes", "createdAt"
        FROM "Guest" 
        WHERE "propertyId" IS NULL
    LOOP
        IF EXISTS (SELECT 1 FROM "Reservation" WHERE "primaryGuestId" = g.id) THEN
            
            SELECT "propertyId" INTO most_recent_prop 
            FROM "Reservation" 
            WHERE "primaryGuestId" = g.id 
            ORDER BY "checkIn" DESC 
            LIMIT 1;

            UPDATE "Guest" SET "propertyId" = most_recent_prop WHERE id = g.id;

            FOR target_prop IN 
                SELECT DISTINCT "propertyId" 
                FROM "Reservation" 
                WHERE "primaryGuestId" = g.id AND "propertyId" != most_recent_prop
            LOOP
                new_guest_id := gen_random_uuid();
                
                INSERT INTO "Guest" (
                    "id", "organizationId", "propertyId", "firstName", "lastName", "email", "phone", "dateOfBirth", "gender", "nationality", 
                    "addressLine1", "addressLine2", "city", "state", "country", "idType", "idNumberEncrypted", "idNumberHint", 
                    "companyName", "companyId", "isVip", "vipLevel", "preferences", "notes", "createdAt", "updatedAt"
                ) VALUES (
                    new_guest_id, g."organizationId", target_prop, g."firstName", g."lastName", g."email", g."phone", g."dateOfBirth", g."gender", g."nationality", 
                    g."addressLine1", g."addressLine2", g."city", g."state", g."country", g."idType", g."idNumberEncrypted", g."idNumberHint", 
                    g."companyName", g."companyId", g."isVip", g."vipLevel", g."preferences", g."notes", g."createdAt", NOW()
                );

                UPDATE "Reservation" SET "primaryGuestId" = new_guest_id WHERE "primaryGuestId" = g.id AND "propertyId" = target_prop;
                UPDATE "ReservationGuest" SET "guestId" = new_guest_id WHERE "guestId" = g.id AND "reservationId" IN (SELECT id FROM "Reservation" WHERE "propertyId" = target_prop);
                UPDATE "Folio" SET "guestId" = new_guest_id WHERE "guestId" = g.id AND "propertyId" = target_prop;
            END LOOP;
        
        ELSE
            IF EXISTS (SELECT 1 FROM "LaundryOrder" WHERE "guestId" = g.id) THEN
                SELECT "propertyId" INTO most_recent_prop FROM "LaundryOrder" WHERE "guestId" = g.id ORDER BY "createdAt" DESC LIMIT 1;
                UPDATE "Guest" SET "propertyId" = most_recent_prop WHERE id = g.id;
            ELSE
                SELECT id INTO most_recent_prop FROM "Property" WHERE "organizationId" = g."organizationId" LIMIT 1;
                IF most_recent_prop IS NOT NULL THEN
                    UPDATE "Guest" SET "propertyId" = most_recent_prop WHERE id = g.id;
                END IF;
            END IF;
        END IF;

    END LOOP;
END $$;
`;

async function main() {
  console.log('Running SQL migration for splitting and backfilling guests...');
  await prisma.$executeRawUnsafe(sql);
  console.log('Data migration complete. Now enforcing NOT NULL constraint...');
  await prisma.$executeRawUnsafe(`ALTER TABLE "Guest" ALTER COLUMN "propertyId" SET NOT NULL;`);
  console.log('NOT NULL constraint successfully enforced.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
