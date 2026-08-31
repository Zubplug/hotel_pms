import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting Guest migration...');

  // Find all guests that have a null propertyId
  const guests = await prisma.guest.findMany({
    where: { propertyId: null },
    include: {
      reservations: {
        include: { property: true },
        orderBy: { checkIn: 'desc' },
      },
    },
  });

  console.log(`Found ${guests.length} guests without propertyId.`);

  let migratedCount = 0;
  let splitCount = 0;
  let unresolvedCount = 0;

  for (const guest of guests) {
    if (guest.reservations.length === 0) {
      // Check if they are referenced anywhere else
      // For now, if no reservations, we log them. They might be from imported lists or failed bookings.
      console.log(`[WARN] Guest ${guest.id} (${guest.firstName} ${guest.lastName}) has no reservations.`);
      unresolvedCount++;
      continue;
    }

    // Get unique propertyIds for this guest's reservations
    const uniquePropertyIds = Array.from(new Set(guest.reservations.map(r => r.propertyId)));

    if (uniquePropertyIds.length === 1) {
      // Simple case: Guest only stayed at one property
      const targetPropertyId = uniquePropertyIds[0];
      await prisma.guest.update({
        where: { id: guest.id },
        data: { propertyId: targetPropertyId },
      });
      migratedCount++;
    } else {
      // Complex case: Guest stayed at multiple properties
      console.log(`[INFO] Guest ${guest.id} stayed at multiple properties. Splitting...`);
      
      // We keep the original guest record for the most recent property
      const mostRecentPropertyId = guest.reservations[0].propertyId;
      
      for (let i = 0; i < uniquePropertyIds.length; i++) {
        const propId = uniquePropertyIds[i];
        
        if (propId === mostRecentPropertyId) {
          // Update the original guest record
          await prisma.guest.update({
            where: { id: guest.id },
            data: { propertyId: mostRecentPropertyId },
          });
          continue;
        }

        // Create a new duplicated guest record for the other property
        const newGuest = await prisma.guest.create({
          data: {
            organizationId: guest.organizationId,
            propertyId: propId,
            firstName: guest.firstName,
            lastName: guest.lastName,
            email: guest.email,
            phone: guest.phone,
            dateOfBirth: guest.dateOfBirth,
            gender: guest.gender,
            nationality: guest.nationality,
            addressLine1: guest.addressLine1,
            addressLine2: guest.addressLine2,
            city: guest.city,
            state: guest.state,
            country: guest.country,
            idType: guest.idType,
            idNumberEncrypted: guest.idNumberEncrypted,
            idNumberHint: guest.idNumberHint,
            companyName: guest.companyName,
            companyId: guest.companyId,
            isVip: guest.isVip,
            vipLevel: guest.vipLevel,
            preferences: guest.preferences || undefined,
            notes: guest.notes,
            createdAt: guest.createdAt,
          },
        });

        // Reassign reservations for this property to the new guest
        const propertyReservations = guest.reservations.filter(r => r.propertyId === propId);
        
        for (const res of propertyReservations) {
          // Update Reservation
          await prisma.reservation.update({
            where: { id: res.id },
            data: { primaryGuestId: newGuest.id },
          });
          
          // Update ReservationGuest link
          await prisma.reservationGuest.updateMany({
            where: { reservationId: res.id, guestId: guest.id },
            data: { guestId: newGuest.id },
          });

          // Update Folios
          await prisma.folio.updateMany({
            where: { reservationId: res.id, guestId: guest.id },
            data: { guestId: newGuest.id },
          });
        }
      }
      
      splitCount++;
    }
  }

  console.log('Migration complete.');
  console.log(`Migrated (Single Property): ${migratedCount}`);
  console.log(`Split (Multiple Properties): ${splitCount}`);
  console.log(`Unresolved (No reservations): ${unresolvedCount}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
