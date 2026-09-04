const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30" }
  }
});

async function main() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  const watermark = new Date();
  
  console.log("Checking all foreign keys for property:", propertyId);
  
  const buildWhere = (base) => ({ ...base, updatedAt: { lte: watermark } });
  
  const staff = await prisma.staff.findMany({
    where: buildWhere({ propertyAccess: { has: propertyId }, isActive: true, deletedAt: null }),
  });
  const staffIds = new Set(staff.map(s => s.id));
  
  const posOrders = await prisma.posOrder.findMany({
    where: { propertyId, updatedAt: { lte: watermark }, OR: [{ status: { in: ['SUBMITTED', 'IN_SERVICE'] } }, { closedAt: { gte: new Date(watermark.getTime() - 2 * 24 * 60 * 60 * 1000) } }] },
    include: { payments: true }
  });
  const posOrderIds = new Set(posOrders.map(o => o.id));
  
  let errors = 0;
  
  for (const o of posOrders) {
      for (const p of o.payments) {
          if (p.processedById && !staffIds.has(p.processedById)) {
              console.log(`❌ PosPayment ${p.id} points to missing Staff ${p.processedById}`);
              errors++;
          }
      }
  }

  const resBaseWhere = {
    propertyId, deletedAt: null,
    OR: [
      { status: 'CHECKED_IN' },
      { status: 'CONFIRMED', checkIn: { lte: new Date(watermark.getTime() + 3 * 24 * 60 * 60 * 1000), gte: new Date(watermark.getTime() - 1 * 24 * 60 * 60 * 1000) } },
      { checkOut: { gte: new Date(watermark.getTime() - 1 * 24 * 60 * 60 * 1000), lte: new Date(watermark.getTime() + 3 * 24 * 60 * 60 * 1000) } }
    ]
  };
  
  const reservations = await prisma.reservation.findMany({
    where: buildWhere(resBaseWhere),
    include: { primaryGuest: true }
  });
  
  // Actually, route.ts pulls guests independently!
  // It pulls all guests with: { propertyId, deletedAt: null, updatedAt: { lte: watermark } }
  const guests = await prisma.guest.findMany({
      where: buildWhere({ propertyId, deletedAt: null })
  });
  const guestIds = new Set(guests.map(g => g.id));
  
  for (const r of reservations) {
      if (r.primaryGuestId && !guestIds.has(r.primaryGuestId)) {
          console.log(`❌ Reservation ${r.id} points to missing Guest ${r.primaryGuestId}`);
          errors++;
      }
  }
  
  if (errors === 0) console.log("✅ Check finished with no errors found!");
  else console.log(`💥 Finished with ${errors} errors!`);
}
main().catch(console.error).finally(() => prisma.$disconnect());
