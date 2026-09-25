'use server';

import { prisma } from '@hotel-pms/db';
import { Prisma } from '@prisma/client';
import { revalidatePath } from 'next/cache';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, getDay } from 'date-fns';
import { requireEventContext } from './access';

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
  const { propertyId } = await requireEventContext();
  if (!(startTime instanceof Date) || Number.isNaN(startTime.getTime()) || !(endTime instanceof Date) || Number.isNaN(endTime.getTime()) || endTime <= startTime) {
    return { hasConflict: true, message: 'Invalid booking time range.' };
  }
  if (!Number.isInteger(setupBufferMinutes) || setupBufferMinutes < 0 || !Number.isInteger(teardownBufferMinutes) || teardownBufferMinutes < 0) {
    return { hasConflict: true, message: 'Invalid booking buffers.' };
  }
  const hall = await prisma.hall.findFirst({ where: { id: hallId, propertyId, isActive: true }, select: { id: true } });
  if (!hall) return { hasConflict: true, message: 'Hall not found or unavailable.' };

  const newEffectiveStart = new Date(startTime.getTime() - setupBufferMinutes * 60000);
  const newEffectiveEnd = new Date(endTime.getTime() + teardownBufferMinutes * 60000);
  
  const searchWindowStart = new Date(newEffectiveStart.getTime() - 24 * 60 * 60 * 1000);
  const searchWindowEnd = new Date(newEffectiveEnd.getTime() + 24 * 60 * 60 * 1000);

  const potentialConflicts = await prisma.eventBooking.findMany({
    where: {
      hallId,
    ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
      startTime: { lt: searchWindowEnd },
      endTime: { gt: searchWindowStart },
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
  const { propertyId } = await requireEventContext();
  return await prisma.hall.findMany({
    where: { propertyId, isActive: true },
    orderBy: { name: 'asc' },
  });
}

export async function getPackages() {
  const { propertyId } = await requireEventContext();
  return await prisma.banquetPackage.findMany({ where: { propertyId, isActive: true }, orderBy: { name: 'asc' } });
}

export async function getEquipment(propertyId?: string) {
  const context = await requireEventContext();
  const scopedPropertyId = propertyId || context.propertyId;
  if (scopedPropertyId !== context.propertyId) throw new Error('Equipment property mismatch.');
  return await prisma.eventEquipment.findMany({ 
    where: { isActive: true, propertyId: scopedPropertyId },
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
  const { propertyId } = await requireEventContext();

  const contactName = data.contactName.trim();
  const expectedGuests = Number(data.expectedGuests);
  const setupBufferMinutes = Number(data.setupBufferMinutes);
  const teardownBufferMinutes = Number(data.teardownBufferMinutes);
  if (!contactName) throw new Error('Contact name is required.');
  if (!Number.isInteger(expectedGuests) || expectedGuests < 1) throw new Error('Expected guests must be at least 1.');
  if (!(data.startTime instanceof Date) || Number.isNaN(data.startTime.getTime())) throw new Error('A valid start time is required.');
  if (!(data.endTime instanceof Date) || Number.isNaN(data.endTime.getTime()) || data.endTime <= data.startTime) throw new Error('End time must be after start time.');
  if (!Number.isInteger(setupBufferMinutes) || setupBufferMinutes < 0 || !Number.isInteger(teardownBufferMinutes) || teardownBufferMinutes < 0) throw new Error('Buffers must be valid non-negative whole minutes.');
  if (data.recurrenceRule && !['NONE', 'DAILY', 'WEEKLY'].includes(data.recurrenceRule.frequency)) throw new Error('Invalid recurrence frequency.');

  return await prisma.$transaction(async (tx) => {
    if (data.bookingType !== 'HALL_ONLY' && data.bookingType !== 'FULL_PACKAGE') {
      throw new Error("Invalid booking type specified.");
    }
    // 1. Verify Hall
    const hall = await tx.hall.findFirst({
      where: { id: data.hallId, propertyId, isActive: true },
      include: { property: true },
    });
    if (!hall) throw new Error("Hall not found");
    if (expectedGuests > hall.capacity) {
      throw new Error(`Expected guests (${expectedGuests}) exceeds hall capacity (${hall.capacity}).`);
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
      if (Number.isNaN(untilDate.getTime()) || untilDate < baseStart) throw new Error('Recurrence end date must be valid and not before the booking.');
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
      const newEffectiveStart = new Date(occ.startTime.getTime() - setupBufferMinutes * 60000);
      const newEffectiveEnd = new Date(occ.endTime.getTime() + teardownBufferMinutes * 60000);
      
      const potentialConflicts = await tx.eventBooking.findMany({
        where: {
          hallId: data.hallId,
          startTime: { lt: new Date(newEffectiveEnd.getTime() + 24 * 60 * 60 * 1000) },
          endTime: { gt: new Date(newEffectiveStart.getTime() - 24 * 60 * 60 * 1000) },
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
          if (!Number.isInteger(eqReq.quantity) || eqReq.quantity < 1) throw new Error('Equipment quantities must be positive whole numbers.');
          const equipment = await tx.eventEquipment.findFirst({ where: { id: eqReq.equipmentId, propertyId, isActive: true }});
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
        expectedGuests,
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
      setupBufferMinutes,
      teardownBufferMinutes,
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
      const packageRecord = await tx.banquetPackage.findFirst({
        where: { id: data.packageIds[0], propertyId, isActive: true },
        select: { id: true },
      });
      if (!packageRecord) throw new Error('Banquet package not found or unavailable.');
      await tx.event.update({
        where: { id: event.id },
        data: { banquetPackageId: data.packageIds[0] }
      });
    }

    revalidatePath('/fnb/events/bookings');
    return event;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
