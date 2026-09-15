'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';

/**
 * Creates a new Banquet Event Order (BEO) for a given event.
 * BEOs serve as the operational source of truth and are versioned.
 */
export async function generateBEO(eventId: string, createdById: string) {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Event with all relevant relationships
    const event = await tx.event.findUnique({
      where: { id: eventId },
      include: {
        bookings: { include: { hall: true } },
        packages: { include: { package: true } },
        equipment: true
      }
    });

    if (!event) throw new Error("Event not found");
    if (event.status === 'CANCELLED') throw new Error("Cannot generate BEO for a cancelled event.");

    // 2. Determine the new version number
    const previousBEOs = await tx.banquetEventOrder.findMany({
      where: { eventId },
      orderBy: { version: 'desc' },
      take: 1
    });
    
    const newVersion = previousBEOs.length > 0 ? previousBEOs[0].version + 1 : 1;

    // 3. Serialize the current state of the event into JSON for the BEO snapshot
    // This snapshot protects against future modifications to the live Event model.
    const snapshotData = {
      eventDetails: {
        name: event.name,
        contactName: event.contactName,
        contactPhone: event.contactPhone,
        contactEmail: event.contactEmail,
        expectedGuests: event.expectedGuests,
        notes: event.notes
      },
      bookings: event.bookings.map(b => ({
        hallName: b.hall.name,
        startTime: b.startTime,
        endTime: b.endTime,
        setupBuffer: b.setupBufferMinutes,
        teardownBuffer: b.teardownBufferMinutes
      })),
      packages: event.packages.map(p => ({
        packageName: p.package.name,
        quantity: p.quantity,
        lockedPrice: p.lockedPrice
      })),
      equipment: event.equipment.map(e => ({
        name: e.name,
        quantity: e.quantity,
        notes: e.notes
      }))
    };

    // 4. Create the BEO
    const beo = await tx.banquetEventOrder.create({
      data: {
        propertyId: event.propertyId,
        eventId: event.id,
        beoNumber: `BEO-${event.id.substring(0, 5).toUpperCase()}-V${newVersion}`,
        version: newVersion,
        status: 'DRAFT',
        snapshotData: JSON.parse(JSON.stringify(snapshotData)), // Ensure serializable
        createdById: createdById,
      }
    });

    revalidatePath(`/fnb/events/bookings/${eventId}`);
    return beo;
  });
}

/**
 * Creates a Change Order against an existing approved BEO.
 */
export async function createChangeOrder(beoId: string, requestedById: string, description: string) {
  const beo = await prisma.banquetEventOrder.findUnique({ where: { id: beoId } });
  if (!beo) throw new Error("BEO not found");
  if (beo.status !== 'APPROVED') throw new Error("Change orders can only be created against APPROVED BEOs.");

  const changeOrder = await prisma.eventChangeOrder.create({
    data: {
      beoId: beo.id,
      requestedById,
      description,
      status: 'PENDING'
    }
  });
  
  revalidatePath(`/fnb/events/beo/${beoId}`);
  return changeOrder;
}
