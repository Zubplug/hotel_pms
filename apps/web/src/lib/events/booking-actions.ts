'use server';

import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, getDay } from 'date-fns';

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
    },
    include: {
      event: { select: { name: true, status: true } }
    }
  });

  for (const booking of potentialConflicts) {
    if (booking.event?.status === 'CANCELLED') continue;
    
    const existingEffectiveStart = new Date(booking.startTime.getTime() - booking.setupBufferMinutes * 60000);
    const existingEffectiveEnd = new Date(booking.endTime.getTime() + booking.teardownBufferMinutes * 60000);

    if (existingEffectiveStart < newEffectiveEnd && existingEffectiveEnd > newEffectiveStart) {
      return {
        hasConflict: true,
        conflictingBookingId: booking.id,
        message: `Conflict with event "${booking.event?.name || 'Unknown'}".`
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

export async function getEquipment() {
  return await prisma.eventEquipment.findMany({ 
    where: { isActive: true },
    orderBy: { name: 'asc' } 
  });
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
  bookingType: 'HALL_ONLY' | 'FULL_PACKAGE';
  equipmentRequests?: { equipmentId: string; quantity: number }[];
  dietaryNotes?: any;
  recurrenceRule?: {
    frequency: string;
    daysOfWeek?: number[];
    until: string;
  };
}) {
  return await prisma.$transaction(async (tx) => {
    if (data.bookingType !== 'HALL_ONLY' && data.bookingType !== 'FULL_PACKAGE') {
      throw new Error("Invalid booking type specified.");
    }
    // 1. Verify Hall
    const hall = await tx.hall.findUnique({ where: { id: data.hallId }, include: { property: true } });
    if (!hall) throw new Error("Hall not found");
    if (data.expectedGuests > hall.capacity) {
      throw new Error(`Expected guests (${data.expectedGuests}) exceeds hall capacity (${hall.capacity}).`);
    }

    // 2. Generate Occurrences preserving local property time
    const occurrences: { startTime: Date, endTime: Date }[] = [];
    const baseStart = data.startTime;
    const baseEnd = data.endTime;
    const durationMs = baseEnd.getTime() - baseStart.getTime();

    occurrences.push({ startTime: baseStart, endTime: baseEnd });

    if (data.recurrenceRule && data.recurrenceRule.frequency !== 'NONE') {
      const propertyTimezone = hall.property.timezone;
      const untilDate = new Date(data.recurrenceRule.until);
      untilDate.setHours(23, 59, 59, 999);
      
      // Convert the initial start time to the property's local time context
      let currentLocalStart = toZonedTime(baseStart, propertyTimezone);
      
      // We start adding from the next day
      currentLocalStart = addDays(currentLocalStart, 1);

      while (fromZonedTime(currentLocalStart, propertyTimezone) <= untilDate) {
        let add = false;
        
        if (data.recurrenceRule.frequency === 'DAILY') {
          add = true;
        } else if (data.recurrenceRule.frequency === 'WEEKLY') {
          // getDay() on the ZonedTime object safely returns the local day of the week
          if (data.recurrenceRule.daysOfWeek?.includes(getDay(currentLocalStart))) {
            add = true;
          }
        }

        if (add) {
          // Convert the local time back to a valid UTC Date
          const nextUtcStart = fromZonedTime(currentLocalStart, propertyTimezone);
          occurrences.push({
            startTime: nextUtcStart,
            endTime: new Date(nextUtcStart.getTime() + durationMs)
          });
        }
        currentLocalStart = addDays(currentLocalStart, 1);
      }
    }

    // 3. Strict Conflict Checking (All-or-Nothing)
    for (const occ of occurrences) {
      const newEffectiveStart = new Date(occ.startTime.getTime() - data.setupBufferMinutes * 60000);
      const newEffectiveEnd = new Date(occ.endTime.getTime() + data.teardownBufferMinutes * 60000);
      
      const potentialConflicts = await tx.eventBooking.findMany({
        where: {
          hallId: data.hallId,
          startTime: { gte: new Date(newEffectiveStart.getTime() - 24 * 60 * 60 * 1000) },
          endTime: { lte: new Date(newEffectiveEnd.getTime() + 24 * 60 * 60 * 1000) },
          status: { not: 'CANCELLED' }
        }
      });

      for (const booking of potentialConflicts) {
        const existingEffectiveStart = new Date(booking.startTime.getTime() - booking.setupBufferMinutes * 60000);
        const existingEffectiveEnd = new Date(booking.endTime.getTime() + booking.teardownBufferMinutes * 60000);
        if (existingEffectiveStart < newEffectiveEnd && existingEffectiveEnd > newEffectiveStart) {
          throw new Error(`Double booking detected for ${occ.startTime.toLocaleDateString()}. The hall is not available.`);
        }
      }

      // Check Equipment inventory
      if (data.equipmentRequests && data.equipmentRequests.length > 0) {
        for (const eqReq of data.equipmentRequests) {
          const equipment = await tx.eventEquipment.findUnique({ where: { id: eqReq.equipmentId }});
          if (!equipment) throw new Error("Equipment not found.");
          
          const conflictingEqBookings = await tx.eventEquipmentBooking.findMany({
            where: {
              equipmentId: eqReq.equipmentId,
              eventBooking: {
                startTime: { lte: new Date(newEffectiveEnd.getTime() + 24 * 60 * 60 * 1000) },
                endTime: { gte: new Date(newEffectiveStart.getTime() - 24 * 60 * 60 * 1000) },
                status: { not: 'CANCELLED' }
              }
            },
            include: { eventBooking: true }
          });
          
          const overlapSum = conflictingEqBookings.reduce((sum, b) => {
            const bStart = new Date(b.eventBooking.startTime.getTime() - b.eventBooking.setupBufferMinutes * 60000);
            const bEnd = new Date(b.eventBooking.endTime.getTime() + b.eventBooking.teardownBufferMinutes * 60000);
            if (bStart < newEffectiveEnd && bEnd > newEffectiveStart) {
              return sum + b.quantity;
            }
            return sum;
          }, 0);

          if (overlapSum + eqReq.quantity > equipment.totalStock) {
            throw new Error(`Insufficient inventory for ${equipment.name} on ${occ.startTime.toLocaleDateString()}. Requested: ${eqReq.quantity}, Available: ${equipment.totalStock - overlapSum}`);
          }
        }
      }
    }

    const finalEndDate = occurrences[occurrences.length - 1].endTime;

    // 4. Create the Base Event
    const event = await tx.event.create({
      data: {
        propertyId: hall.propertyId,
        name: `Event for ${data.contactName}`,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        expectedGuests: data.expectedGuests,
        startDate: occurrences[0].startTime,
        endDate: finalEndDate,
        status: 'TENTATIVE',
        recurrenceRule: data.recurrenceRule ? data.recurrenceRule : undefined,
        notes: data.dietaryNotes ? JSON.stringify(data.dietaryNotes) : undefined,
      }
    });

    // 5. Create All Bookings
    const bookingRecords = occurrences.map(occ => ({
      eventId: event.id,
      hallId: data.hallId,
      startTime: occ.startTime,
      endTime: occ.endTime,
      setupBufferMinutes: data.setupBufferMinutes,
      teardownBufferMinutes: data.teardownBufferMinutes,
      status: 'ACTIVE'
    }));

    await tx.eventBooking.createMany({
      data: bookingRecords
    });

    const createdBookings = await tx.eventBooking.findMany({
      where: { eventId: event.id }
    });

    // 6. Create Equipment Bookings
    if (data.equipmentRequests && data.equipmentRequests.length > 0) {
      const eqRecords: any[] = [];
      for (const cb of createdBookings) {
        for (const req of data.equipmentRequests) {
          eqRecords.push({
            eventBookingId: cb.id,
            equipmentId: req.equipmentId,
            quantity: req.quantity
          });
        }
      }
      if (eqRecords.length > 0) {
        await tx.eventEquipmentBooking.createMany({ data: eqRecords });
      }
    }

    // 7. Attach Package
    if (data.packageIds && data.packageIds.length > 0 && data.bookingType === 'FULL_PACKAGE') {
      await tx.event.update({
        where: { id: event.id },
        data: { banquetPackageId: data.packageIds[0] }
      });
    }

    revalidatePath('/fnb/events/bookings');
    return event;
  });
}
