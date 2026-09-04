const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30" }
  }
});

async function main() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  const reservations = await prisma.reservation.findMany({
    where: { propertyId },
    include: { folios: true }
  });

  let found = false;
  for (const r of reservations) {
    if (r.folios.length > 1) {
      console.log(`🚨 Reservation ${r.id} has ${r.folios.length} Folios! SQLite expects 1-to-1!`);
      found = true;
    }
  }
  if (!found) console.log("✅ All reservations have at most 1 folio.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
