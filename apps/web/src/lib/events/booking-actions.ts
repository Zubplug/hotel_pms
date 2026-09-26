'use server';

import crypto from 'node:crypto';
import { prisma } from '@hotel-pms/db';
import { revalidatePath } from 'next/cache';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import { addDays, getDay } from 'date-fns';
import { requireEventContext, requireEventRole } from './access';

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


function codeToken(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'CORP';
}

async function generateCorporateCode(tx: any, propertyId: string, name: string) {
  const prefix = codeToken(name);
  for (let index = 1; index <= 99; index += 1) {
    const suffix = String(index).padStart(2, '0');
    const candidate = `${prefix.slice(0, 10 - suffix.length)}${suffix}`;
    const existing = await tx.corporateAccount.findFirst({
      where: { propertyId, code: candidate },
      select: { id: true },
    });
    if (!existing) return candidate;
  }
  return `CORP${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
}

export type ClientBookingData = {
  clientType: 'INDIVIDUAL' | 'CORPORATE';
  isExisting: boolean;
  clientId?: string;
  clientDetails?: {
    firstName?: string;
    lastName?: string;
    phone?: string;
    email?: string;
    companyName?: string;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
  };
  contactName?: string;
  contactPhone?: string;
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
  recurrenceRule?: { frequency: string; daysOfWeek?: number[]; until: string; };
  // Financial
  hallRate?: number; // Deprecated client hint; never trusted
  discountAmount?: number; // Legacy total request; prefer discountByCategory
  discountByCategory?: { hall?: number; equipment?: number; food?: number };
};

export async function createFullEventBooking(data: ClientBookingData) {
  const { propertyId, userId } = await requireEventRole('FNB');

  const expectedGuests = Number(data.expectedGuests);
  const setupBufferMinutes = Number(data.setupBufferMinutes);
  const teardownBufferMinutes = Number(data.teardownBufferMinutes);
  if (!Number.isInteger(expectedGuests) || expectedGuests < 1) throw new Error('Expected guests must be at least 1.');
  if (!(data.startTime instanceof Date) || Number.isNaN(data.startTime.getTime())) throw new Error('A valid start time is required.');
  if (!(data.endTime instanceof Date) || Number.isNaN(data.endTime.getTime()) || data.endTime <= data.startTime) throw new Error('End time must be after start time.');
  if (!Number.isInteger(setupBufferMinutes) || setupBufferMinutes < 0 || !Number.isInteger(teardownBufferMinutes) || teardownBufferMinutes < 0) throw new Error('Buffers must be valid non-negative whole minutes.');
  if (data.recurrenceRule && !['NONE', 'DAILY', 'WEEKLY'].includes(data.recurrenceRule.frequency)) throw new Error('Invalid recurrence frequency.');

  return await prisma.$transaction(async (tx) => {
    // A. Fetch Property/Organization
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error("Property not found");
    const organizationId = property.organizationId;

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
    const hallRate = hall.rate?.toNumber();
    if (hallRate == null || !Number.isFinite(hallRate) || hallRate < 0) throw new Error('The selected hall has no valid rate configured.');

    // 2. Client Resolution
    let guestId: string | null = null;
    let corporateAccountId: string | null = null;
    let folioId: string | null = null;
    let cityLedgerAccountId: string | null = null;

    if (data.clientType === 'INDIVIDUAL') {
      if (data.isExisting && data.clientId) {
        const guest = await tx.guest.findFirst({ where: { id: data.clientId, propertyId, deletedAt: null }});
        if (!guest) throw new Error("Guest not found");
        guestId = guest.id;
      } else {
        if (!data.clientDetails?.firstName || !data.clientDetails?.lastName) throw new Error("First and last name required for new individual");
        const guest = await tx.guest.create({
          data: {
            organizationId,
            propertyId,
            firstName: data.clientDetails.firstName,
            lastName: data.clientDetails.lastName,
            email: data.clientDetails.email,
            phone: data.clientDetails.phone,
          }
        });
        guestId = guest.id;
      }

      // Ensure Folio exists for this individual
      // Instead of relying on a generic master folio, we create one for this specific event's billing
      const existingFolio = await tx.folio.findFirst({
        where: { propertyId, guestId, type: 'MASTER', status: 'OPEN' },
        orderBy: { createdAt: 'asc' },
      });
      const folio = existingFolio || await tx.folio.create({
        data: { propertyId, guestId, type: 'MASTER', status: 'OPEN', currency: 'NGN', folioNumber: `FOL-${crypto.randomBytes(4).toString('hex').toUpperCase()}` }
      });
      folioId = folio.id;

    } else if (data.clientType === 'CORPORATE') {
      if (data.isExisting && data.clientId) {
        const corp = await tx.corporateAccount.findFirst({ where: { id: data.clientId, propertyId }, include: { cityLedgerAccount: true } });
        if (!corp) throw new Error("Corporate account not found");
        corporateAccountId = corp.id;
        cityLedgerAccountId = corp.cityLedgerAccountId || null;
        if (!cityLedgerAccountId) throw new Error('Corporate account has no linked city ledger account.');
      } else {
        if (!data.clientDetails?.companyName) throw new Error("Company name required for new corporate account");
        const code = await generateCorporateCode(tx, propertyId, data.clientDetails.companyName);

        // Create CityLedger
        const ledger = await tx.cityLedgerAccount.create({
          data: {
            organizationId,
            propertyId,
            name: data.clientDetails.companyName,
            type: 'CORPORATE',
            status: 'ACTIVE',
            currency: 'NGN'
          }
        });
        cityLedgerAccountId = ledger.id;

        // Create Corp Account
        const corp = await tx.corporateAccount.create({
          data: {
            organizationId,
            propertyId,
            name: data.clientDetails.companyName,
            code,
            contactPerson: data.clientDetails.contactPerson,
            contactEmail: data.clientDetails.contactEmail,
            contactPhone: data.clientDetails.contactPhone,
            depositPolicy: 'WAIVED',
            cityLedgerAccountId: ledger.id
          }
        });
        corporateAccountId = corp.id;
      }
    } else {
      throw new Error("Invalid client type");
    }

    if (!guestId && !corporateAccountId) throw new Error("No client resolved.");
    if (guestId && corporateAccountId) throw new Error("Cannot have both guest and corporate account.");

    const resolvedGuest = guestId
      ? await tx.guest.findUnique({ where: { id: guestId }, select: { firstName: true, lastName: true, phone: true, email: true } })
      : null;
    const resolvedCorporate = corporateAccountId
      ? await tx.corporateAccount.findUnique({ where: { id: corporateAccountId }, select: { name: true, contactPerson: true, contactPhone: true, contactEmail: true } })
      : null;
    const contactName = data.clientType === 'INDIVIDUAL'
      ? `${resolvedGuest?.firstName || ''} ${resolvedGuest?.lastName || ''}`.trim()
      : (resolvedCorporate?.contactPerson || resolvedCorporate?.name || data.clientDetails?.contactPerson || data.clientDetails?.companyName || '').trim();
    const contactPhone = data.clientType === 'INDIVIDUAL'
      ? (resolvedGuest?.phone || data.clientDetails?.phone || data.contactPhone || '')
      : (resolvedCorporate?.contactPhone || data.clientDetails?.contactPhone || data.contactPhone || '');
    if (!contactName) throw new Error('Client contact could not be resolved.');

    // 3. Generate Occurrences preserving local property time
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

      let currentLocalStart = toZonedTime(baseStart, propertyTimezone);
      currentLocalStart = addDays(currentLocalStart, 1);

      while (fromZonedTime(currentLocalStart, propertyTimezone) <= untilDate) {
        let add = false;

        if (data.recurrenceRule.frequency === 'DAILY') {
          add = true;
        } else if (data.recurrenceRule.frequency === 'WEEKLY') {
          if (data.recurrenceRule.daysOfWeek?.includes(getDay(currentLocalStart))) {
            add = true;
          }
        }

        if (add) {
          const nextUtcStart = fromZonedTime(currentLocalStart, propertyTimezone);
          occurrences.push({
            startTime: nextUtcStart,
            endTime: new Date(nextUtcStart.getTime() + durationMs)
          });
        }
        currentLocalStart = addDays(currentLocalStart, 1);
      }
    }

    // 4. Strict Conflict Checking (All-or-Nothing)
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

    const packageRecord = data.bookingType === 'FULL_PACKAGE' && data.packageIds?.[0]
      ? await tx.banquetPackage.findFirst({ where: { id: data.packageIds[0], propertyId, isActive: true } })
      : null;
    if (data.bookingType === 'FULL_PACKAGE' && !packageRecord) throw new Error('Banquet package not found or unavailable.');

    const equipmentIds = [...new Set((data.equipmentRequests || []).map((request) => request.equipmentId))];
    const equipmentRecords = equipmentIds.length
      ? await tx.eventEquipment.findMany({ where: { id: { in: equipmentIds }, propertyId, isActive: true } })
      : [];
    if (equipmentRecords.length !== equipmentIds.length) throw new Error('One or more equipment items are unavailable.');

    // Server-side financial snapshot. The client supplies category requests only;
    // accounting approval is required before any discount becomes final.
    const occurrencesCount = occurrences.length;
    const hallGross = hallRate * occurrencesCount;
    const packageGross = packageRecord ? packageRecord.basePrice.toNumber() * occurrencesCount : 0;
    const equipmentGross = (data.equipmentRequests || []).reduce((sum, request) => {
      const equipment = equipmentRecords.find((item) => item.id === request.equipmentId);
      return sum + (equipment?.rentalPrice.toNumber() || 0) * request.quantity * occurrencesCount;
    }, 0);
    const grossTotal = hallGross + packageGross + equipmentGross;
    const legacyDiscount = Number(data.discountAmount || 0);
    if (!Number.isFinite(legacyDiscount) || legacyDiscount < 0) throw new Error('Discount must be a valid non-negative amount.');
    const categoryGross = { hall: hallGross, equipment: equipmentGross, food: packageGross };
    const suppliedDiscounts = data.discountByCategory || {};
    const requestedDiscounts = (['hall', 'equipment', 'food'] as const).reduce((result, category) => {
      const supplied = suppliedDiscounts[category];
      const raw = supplied == null && legacyDiscount > 0
        ? legacyDiscount * (grossTotal ? categoryGross[category] / grossTotal : 0)
        : Number(supplied || 0);
      if (!Number.isFinite(raw) || raw < 0) throw new Error(`${category} discount must be a valid non-negative amount.`);
      result[category] = Math.min(raw, categoryGross[category]);
      return result;
    }, {} as Record<'hall' | 'equipment' | 'food', number>);
    const discount = requestedDiscounts.hall + requestedDiscounts.equipment + requestedDiscounts.food;
    const tax = await tx.tax.findFirst({ where: { propertyId, isActive: true, OR: [{ code: 'VAT' }, { name: { contains: 'VAT', mode: 'insensitive' } }] }, orderBy: { createdAt: 'asc' } });
    const taxableSubtotal = Math.max(0, grossTotal - discount);
    const taxRate = tax?.type === 'PERCENTAGE' ? tax.rate.toNumber() / 100 : 0;
    const taxAmt = tax?.type === 'FLAT' ? Math.max(0, tax.rate.toNumber()) : taxableSubtotal * taxRate;
    const subTotal = taxableSubtotal;
    const netTotal = subTotal + taxAmt;

    // 5. Create the Base Event
    const event = await tx.event.create({
      data: {
        propertyId: hall.propertyId,
        name: `Event for ${contactName}`,
        contactName,
        contactPhone,
        expectedGuests,
        startDate: occurrences[0].startTime,
        endDate: finalEndDate,
        status: 'TENTATIVE',
        recurrenceRule: data.recurrenceRule ? data.recurrenceRule : undefined,
        notes: data.dietaryNotes ? JSON.stringify(data.dietaryNotes) : undefined,
        guestId,
        corporateAccountId
      }
    });

    // 6. Create All Bookings
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

    // 7. Create Equipment Bookings
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

    // 8. Attach Package
    if (packageRecord) {
      await tx.event.update({
        where: { id: event.id },
        data: { banquetPackageId: packageRecord.id }
      });
    }

    // 9. Create EventInvoice (Financial Snapshot)
    const invoice = await tx.eventInvoice.create({
      data: {
        eventId: event.id,
        subTotal: subTotal,
        totalDiscount: discount,
        totalTax: taxAmt,
        totalAmount: netTotal,
        paidAmount: 0,
        status: 'DRAFT',
        workflowStatus: 'SUBMITTED',
        requestedDiscount: discount,
        discountReason: data.discountAmount ? 'Requested during booking; subject to accounting approval.' : undefined,
        submittedBy: userId,
        submittedAt: new Date(),
        folioId,
        cityLedgerAccountId
      }
    });

    // 10. Create immutable line snapshots. Discount and tax are allocated pro-rata.
    const lines = [
      { description: `Hall Rental: ${hall.name}`, category: 'HALL', discountCategory: 'hall' as const, quantity: occurrencesCount, unitPrice: hallRate, gross: hallGross },
      ...(packageRecord ? [{ description: `Banquet Package / Food: ${packageRecord.name}`, category: 'FOOD', discountCategory: 'food' as const, quantity: occurrencesCount, unitPrice: packageRecord.basePrice.toNumber(), gross: packageGross }] : []),
      ...(data.equipmentRequests || []).map((request) => {
        const equipment = equipmentRecords.find((item) => item.id === request.equipmentId)!;
        return { description: `Equipment: ${equipment.name}`, category: 'EQUIPMENT', discountCategory: 'equipment' as const, quantity: request.quantity * occurrencesCount, unitPrice: equipment.rentalPrice.toNumber(), gross: equipment.rentalPrice.toNumber() * request.quantity * occurrencesCount };
      }),
    ];
    await tx.eventInvoiceItem.createMany({ data: lines.map((line) => {
      const categoryLinesGross = lines.filter((candidate) => candidate.discountCategory === line.discountCategory).reduce((sum, candidate) => sum + candidate.gross, 0);
      const lineDiscount = categoryLinesGross ? requestedDiscounts[line.discountCategory] * (line.gross / categoryLinesGross) : 0;
      const lineTax = grossTotal ? taxAmt * ((line.gross - lineDiscount) / taxableSubtotal || 0) : 0;
      return { invoiceId: invoice.id, description: line.description, category: line.category, quantity: line.quantity, unitPrice: line.unitPrice, grossAmount: line.gross, requestedDiscount: lineDiscount, discountAmount: lineDiscount, discountStatus: 'PENDING', taxAmount: lineTax, totalPrice: line.gross - lineDiscount + lineTax, taxId: tax?.id };
    }) });

    revalidatePath('/fnb/events/bookings');
    return event;
  }, { isolationLevel: 'Serializable' as any });
}
