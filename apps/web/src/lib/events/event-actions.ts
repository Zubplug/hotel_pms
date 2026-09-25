'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { requireEventContext } from './access';

/**
 * Creates a new Banquet Event Order (BEO) for a given event.
 * BEOs serve as the operational source of truth and are versioned.
 */
export async function generateBEO(eventId: string, _createdById?: string) {
  const { propertyId } = await requireEventContext();
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch Event with all relevant relationships
    const event = await tx.event.findUnique({
      where: { id: eventId, propertyId },
      include: {
        bookings: { include: { hall: true } },
        banquetPackage: { include: { items: true } }
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
      bookings: event.bookings.map((b: any) => ({
        hallName: b.hall.name,
        startTime: b.startTime,
        endTime: b.endTime,
        setupBuffer: b.setupBufferMinutes,
        teardownBuffer: b.teardownBufferMinutes
      })),
      package: event.banquetPackage ? {
        name: event.banquetPackage.name,
        price: event.banquetPackage.basePrice
      } : null
    };

    // 4. Create the BEO
    const beo = await tx.banquetEventOrder.create({
      data: {
        eventId: event.id,
        version: newVersion,
        status: 'DRAFT',
        snapshotData: JSON.parse(JSON.stringify(snapshotData)), // Ensure serializable
        approvedBy: null,
      }
    });

    revalidatePath(`/fnb/events/bookings/${eventId}`);
    return beo;
  });
}

/**
 * Creates a Change Order against an existing approved BEO.
 */
export async function createChangeOrder(eventId: string, _requestedById: string | undefined, description: string) {
  const { propertyId, userId } = await requireEventContext();
  const event = await prisma.event.findFirst({ where: { id: eventId, propertyId }, select: { id: true } });
  if (!event) throw new Error('Event not found.');
  const cleanDescription = description.trim();
  if (!cleanDescription) throw new Error('Change order description is required.');
  const changeOrder = await prisma.eventChangeOrder.create({
    data: {
      eventId: eventId,
      requestedBy: userId,
      description: cleanDescription,
      status: 'PENDING'
    }
  });
  
  revalidatePath(`/fnb/events/bookings/${eventId}`);
  return changeOrder;
}
