const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const propertyId = "9b8a4229-4059-42f4-9565-51cfdbe79046";
  
  const reservations = await prisma.reservation.findMany({ where: { propertyId } });
  const guests = await prisma.guest.findMany({ where: { propertyId } });
  const guestIds = new Set(guests.map(g => g.id));
  
  for (const r of reservations) {
    if (r.primaryGuestId && !guestIds.has(r.primaryGuestId)) {
      console.log(`Reservation ${r.id} has invalid primaryGuestId: ${r.primaryGuestId}`);
    }
    if (r.corporateAccountId) {
       const corp = await prisma.corporateAccount.findUnique({ where: { id: r.corporateAccountId }});
       if (!corp || corp.propertyId !== propertyId) {
          console.log(`Reservation ${r.id} has invalid corporateAccountId: ${r.corporateAccountId}`);
       }
    }
  }
  
  const reservationGuests = await prisma.reservationGuest.findMany({ where: { reservation: { propertyId } } });
  for (const rg of reservationGuests) {
    if (!guestIds.has(rg.guestId)) {
      console.log(`ReservationGuest ${rg.id} has invalid guestId: ${rg.guestId}`);
    }
  }
}
run().catch(console.error).finally(() => prisma.$disconnect());
