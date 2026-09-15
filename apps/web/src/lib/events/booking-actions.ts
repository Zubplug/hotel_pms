'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';

export type BookingConflictResult = {
  hasConflict: boolean;
  conflictingBookingId?: string;
  message?: string;
};

export async function checkHallAvailability(
  hallId: string,
  startTime: Date,
  endTime: Date,
  setupBufferMinutes: number = 0,
  teardownBufferMinutes: number = 0,
  excludeBookingId?: string
): Promise<BookingConflictResult> {
  const newEffectiveStart = new Date(startTime.getTime() - setupBufferMinutes * 60000);
  const newEffectiveEnd = new Date(endTime.getTime() + teardownBufferMinutes * 60000);
  
  const searchWindowStart = new Date(newEffectiveStart.getTime() - 24 * 60 * 60 * 1000);
  const searchWindowEnd = new Date(newEffectiveEnd.getTime() + 24 * 60 * 60 * 1000);

  const potentialConflicts = await prisma.eventBooking.findMany({
    where: {
      hallId,
      id: { not: excludeBookingId },
      startTime: { gte: searchWindowStart },
      endTime: { lte: searchWindowEnd },
      status: { notIn: ['CANCELLED'] } 
    },
    include: {
      event: { select: { name: true } }
    }
  });

  for (const booking of potentialConflicts) {
    const existingEffectiveStart = new Date(booking.startTime.getTime() - booking.setupBufferMinutes * 60000);
    const existingEffectiveEnd = new Date(booking.endTime.getTime() + booking.teardownBufferMinutes * 60000);

    if (existingEffectiveStart < newEffectiveEnd && existingEffectiveEnd > newEffectiveStart) {
      return {
        hasConflict: true,
        conflictingBookingId: booking.id,
        message: `Conflict with event "${booking.event.name}".`
      };
    }
  }

  return { hasConflict: false };
}

export async function getHalls() {
  return await prisma.hall.findMany({ orderBy: { name: 'asc' } });
}

export async function getPackages() {
  return await prisma.banquetPackage.findMany({ orderBy: { name: 'asc' } });
}

export async function createFullEventBooking(data: {
  contactName: string;
  contactPhone: string;
  expectedGuests: number;
  hallId: string;
  startTime: Date;
  endTime: Date;
  setupBufferMinutes: number;
  teardownBufferMinutes: number;
  packageIds: string[];
}) {
  return await prisma.$transaction(async (tx) => {
    // 1. Verify Hall
    const hall = await tx.hall.findUnique({ where: { id: data.hallId } });
    if (!hall) throw new Error("Hall not found");
    if (data.expectedGuests > hall.capacity) {
      throw new Error(`Expected guests (${data.expectedGuests}) exceeds hall capacity (${hall.capacity}).`);
    }

    // 2. Check conflicts strictly
    const newEffectiveStart = new Date(data.startTime.getTime() - data.setupBufferMinutes * 60000);
    const newEffectiveEnd = new Date(data.endTime.getTime() + data.teardownBufferMinutes * 60000);
    
    const potentialConflicts = await tx.eventBooking.findMany({
      where: {
        hallId: data.hallId,
        status: { notIn: ['CANCELLED'] },
        startTime: { gte: new Date(newEffectiveStart.getTime() - 24 * 60 * 60 * 1000) },
        endTime: { lte: new Date(newEffectiveEnd.getTime() + 24 * 60 * 60 * 1000) },
      }
    });

    for (const booking of potentialConflicts) {
      const existingEffectiveStart = new Date(booking.startTime.getTime() - booking.setupBufferMinutes * 60000);
      const existingEffectiveEnd = new Date(booking.endTime.getTime() + booking.teardownBufferMinutes * 60000);
      if (existingEffectiveStart < newEffectiveEnd && existingEffectiveEnd > newEffectiveStart) {
        throw new Error("Double booking detected. The hall is not available for the requested time frame including buffers.");
      }
    }

    // 3. Create the Base Event
    const event = await tx.event.create({
      data: {
        propertyId: hall.propertyId, // Inherit from hall for safety
        name: `Event for ${data.contactName}`,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        expectedGuests: data.expectedGuests,
        startDate: data.startTime,
        endDate: data.endTime,
        status: 'TENTATIVE',
      }
    });

    // 4. Create Booking
    await tx.eventBooking.create({
      data: {
        eventId: event.id,
        hallId: data.hallId,
        startTime: data.startTime,
        endTime: data.endTime,
        setupBufferMinutes: data.setupBufferMinutes,
        teardownBufferMinutes: data.teardownBufferMinutes,
        status: 'TENTATIVE',
      }
    });

    // 5. Attach Packages
    if (data.packageIds && data.packageIds.length > 0) {
      const packages = await tx.banquetPackage.findMany({
        where: { id: { in: data.packageIds } }
      });
      
      for (const pkg of packages) {
        await tx.eventPackage.create({
          data: {
            eventId: event.id,
            packageId: pkg.id,
            quantity: 1,
            lockedPrice: pkg.basePrice,
          }
        });
      }
    }

    revalidatePath('/fnb/events/bookings');
    return event;
  });
}
