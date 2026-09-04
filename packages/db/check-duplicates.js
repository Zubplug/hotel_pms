const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({
  datasources: {
    db: { url: "postgresql://neondb_owner:npg_2TMUSHGXeFx8@ep-aged-thunder-ayuphsro.c-5.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=30" }
  }
});

async function main() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  const watermark = new Date();
  const buildWhere = (base) => ({ ...base, updatedAt: { lte: watermark } });

  const twoDaysAgo = new Date(watermark.getTime() - 2 * 24 * 60 * 60 * 1000);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
  const threeDaysFromNow = new Date(now); threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

  const resBaseWhere = {
    propertyId, deletedAt: null,
    OR: [
      { status: 'CHECKED_IN' },
      { status: 'CONFIRMED', checkIn: { lte: threeDaysFromNow, gte: yesterday } },
      { checkOut: { gte: yesterday, lte: threeDaysFromNow } }
    ]
  };
  
  const reservations = await prisma.reservation.findMany({
    where: buildWhere(resBaseWhere),
    include: {
      primaryGuest: true,
      reservationGuests: { include: { guest: true } },
      reservationRooms: { where: { status: 'ACTIVE' }, include: { room: true } },
      folios: { include: { items: true, payments: true, credits: true } },
      lockCredentials: true,
      lockOperations: true
    }
  });

  const guests = [];
  const folios = [];
  reservations.forEach(r => {
    if (r.primaryGuest) guests.push(r.primaryGuest);
    r.reservationGuests.forEach(rg => { if (rg.guest) guests.push(rg.guest); });
    r.folios.forEach(f => folios.push(f));
  });

  const checkDups = (arr, name) => {
    const ids = new Set();
    let dupFound = false;
    arr.forEach(e => {
      if (ids.has(e.id)) { console.log(`🚨 DUP FOUND in ${name}: ${e.id}`); dupFound = true; }
      ids.add(e.id);
    });
    if (!dupFound) console.log(`✅ No duplicates in ${name}.`);
  };

  checkDups(reservations, "Reservations");
  checkDups(guests, "Guests");
  checkDups(folios, "Folios");
  
  // also check payments inside folios
  const payments = [];
  const items = [];
  folios.forEach(f => {
    f.payments.forEach(p => payments.push(p));
    f.items.forEach(i => items.push(i));
  });
  
  checkDups(payments, "Payments");
  checkDups(items, "FolioItems");
}

main().catch(console.error).finally(() => prisma.$disconnect());
