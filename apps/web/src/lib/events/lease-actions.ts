'use server';

import { prisma } from '@hotel-pms/db';
import { requireEventContext, requireEventRole } from './access';

type LeaseFrequency = 'PER_USE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
type UsageFrequency = 'PER_USE' | 'DAILY' | 'WEEKLY';

const dateOnly = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 86400000);
const addMonths = (value: Date, months: number) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, value.getUTCDate()));
const nextPeriodEnd = (start: Date, frequency: LeaseFrequency) => frequency === 'WEEKLY'
  ? addDays(start, 6)
  : frequency === 'MONTHLY'
    ? addDays(addMonths(start, 1), -1)
    : frequency === 'QUARTERLY'
      ? addDays(addMonths(start, 3), -1)
      : frequency === 'YEARLY'
        ? addDays(addMonths(start, 12), -1)
        : start;

function usageDates(start: Date, end: Date, frequency: UsageFrequency, days: number[]) {
  if (frequency === 'PER_USE') return [start];
  const dates: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    if (frequency === 'DAILY' || days.includes(cursor.getUTCDay())) dates.push(cursor);
  }
  return dates;
}

function atTime(day: Date, value: string | undefined, fallback: string) {
  const time = value || fallback;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('Lease times must use HH:mm format.');
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), Number(match[1]), Number(match[2])));
}

function buildSchedules(input: { startDate: Date; endDate: Date; rate: number; usageFrequency: UsageFrequency; billingFrequency: LeaseFrequency; usageDays: number[]; billingDates?: Date[] }) {
  const schedules: { periodStart: Date; periodEnd: Date; dueDate: Date; usageCount: number; amount: number }[] = [];
  if (input.usageFrequency === 'PER_USE' && input.billingFrequency === 'PER_USE') {
    return [{ periodStart: input.startDate, periodEnd: input.startDate, dueDate: input.startDate, usageCount: 1, amount: input.rate }];
  }
  if (input.billingFrequency === 'CUSTOM') {
    let periodStart = input.startDate;
    for (const dueDate of input.billingDates || []) {
      const periodEnd = dueDate < input.endDate ? dueDate : input.endDate;
      const count = usageDates(periodStart, periodEnd, input.usageFrequency, input.usageDays).length;
      if (count > 0) schedules.push({ periodStart, periodEnd, dueDate, usageCount: count, amount: input.rate * count });
      periodStart = addDays(periodEnd, 1);
    }
    if (periodStart <= input.endDate) {
      const count = usageDates(periodStart, input.endDate, input.usageFrequency, input.usageDays).length;
      if (count > 0) schedules.push({ periodStart, periodEnd: input.endDate, dueDate: input.endDate, usageCount: count, amount: input.rate * count });
    }
    return schedules;
  }
  let periodStart = input.startDate;
  while (periodStart <= input.endDate) {
    if (input.billingFrequency === 'PER_USE') {
      const usage = usageDates(periodStart, periodStart, input.usageFrequency, input.usageDays);
      if (usage.length) schedules.push({ periodStart, periodEnd: periodStart, dueDate: periodStart, usageCount: 1, amount: input.rate });
      periodStart = addDays(periodStart, 1);
      continue;
    }
    const periodEnd = new Date(Math.min(nextPeriodEnd(periodStart, input.billingFrequency).getTime(), input.endDate.getTime()));
    const count = usageDates(periodStart, periodEnd, input.usageFrequency, input.usageDays).length;
    if (count > 0) schedules.push({ periodStart, periodEnd, dueDate: periodStart, usageCount: count, amount: input.rate * count });
    periodStart = addDays(periodEnd, 1);
  }
  return schedules;
}

export async function createLeaseContract(input: {
  propertyId: string;
  corporateAccountId: string;
  hallId: string;
  startDate: Date;
  endDate: Date;
  usageFrequency: UsageFrequency;
  billingFrequency: LeaseFrequency;
  customBillingDates?: Date[];
  usageDays?: number[];
  startTime?: string;
  endTime?: string;
  rate: number;
  depositAmount?: number;
  contactName: string;
  contactEmail?: string;
}) {
  const { propertyId, userId } = await requireEventRole('FNB');
  if (propertyId !== input.propertyId) throw new Error('Property access denied.');
  const startDate = dateOnly(input.startDate);
  const endDate = dateOnly(input.endDate);
  if (endDate < startDate) throw new Error('Lease end date must be after the start date.');
  if (!Number.isFinite(input.rate) || input.rate <= 0) throw new Error('Lease rate must be greater than zero.');
  if (!['PER_USE', 'DAILY', 'WEEKLY'].includes(input.usageFrequency) || !['PER_USE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'].includes(input.billingFrequency)) throw new Error('Invalid lease frequency.');
  if (input.usageFrequency === 'PER_USE' && input.billingFrequency !== 'PER_USE') throw new Error('A single/per-use contract must be billed per use. Use Weekly or Daily usage for recurring billing.');
  const customBillingDates = [...new Set((input.customBillingDates || []).map(dateOnly).map((date) => date.toISOString()))].map((value) => new Date(value)).sort((left, right) => left.getTime() - right.getTime());
  if (input.billingFrequency === 'CUSTOM' && customBillingDates.length === 0) throw new Error('Custom billing requires at least one billing date.');
  if (customBillingDates.some((date) => date < startDate || date > endDate)) throw new Error('Custom billing dates must fall within the contract period.');
  const usageDays = [...new Set((input.usageDays || [startDate.getUTCDay()]).map(Number))].filter((day) => day >= 0 && day <= 6);
  const startTime = input.startTime || '09:00';
  const endTime = input.endTime || '17:00';
  if (atTime(startDate, endTime, endTime) <= atTime(startDate, startTime, startTime)) throw new Error('Lease end time must be after start time.');
  if (input.billingFrequency === 'PER_USE' && input.usageFrequency !== 'PER_USE' && usageDays.length === 0) throw new Error('Select at least one recurring usage day.');
  return prisma.$transaction(async (tx) => {
    const [property, hall, corporate] = await Promise.all([
      tx.property.findFirst({ where: { id: propertyId } }),
      tx.hall.findFirst({ where: { id: input.hallId, propertyId, isActive: true } }),
      tx.corporateAccount.findFirst({ where: { id: input.corporateAccountId, propertyId }, include: { cityLedgerAccount: true } }),
    ]);
    if (!property || !hall) throw new Error('Property or hall not found.');
    if (!corporate?.cityLedgerAccountId || corporate.cityLedgerAccount?.status !== 'ACTIVE') throw new Error('Corporate account must have an active City Ledger account.');
    const occurrences = usageDates(startDate, endDate, input.usageFrequency, usageDays);
    if (!occurrences.length) throw new Error('The lease produces no hall usage dates.');
    const occurrenceWindows = occurrences.map((day) => ({ startTime: atTime(day, startTime, '09:00'), endTime: atTime(day, endTime, '17:00') }));
    for (const window of occurrenceWindows) {
      const conflict = await tx.eventBooking.findFirst({
        where: {
          hallId: hall.id,
          status: 'ACTIVE',
          startTime: { lt: window.endTime },
          endTime: { gt: window.startTime },
        },
        select: { id: true },
      });
      if (conflict) throw new Error(`Hall ${hall.name} is already booked during one of the requested recurring periods.`);
    }
    const event = await tx.event.create({
      data: {
        propertyId,
        name: `${corporate.name} — ${hall.name} recurring hall use`,
        contactName: input.contactName.trim(),
        contactEmail: input.contactEmail?.trim() || null,
        corporateAccountId: corporate.id,
        status: 'CONFIRMED',
        financialStatus: 'QUOTE',
        startDate: occurrenceWindows[0].startTime,
        endDate: occurrenceWindows[occurrenceWindows.length - 1].endTime,
        expectedGuests: 1,
        recurrenceRule: { frequency: input.usageFrequency, daysOfWeek: usageDays, until: endDate.toISOString().slice(0, 10) },
      },
    });
    const contract = await tx.leaseContract.create({
      data: {
        propertyId, corporateAccountId: corporate.id, hallId: hall.id, eventId: event.id, contactName: input.contactName.trim(), contactEmail: input.contactEmail?.trim() || null,
        startDate, endDate, usageFrequency: input.usageFrequency, billingFrequency: input.billingFrequency, billingDates: customBillingDates.map((date) => date.toISOString().slice(0, 10)), usageDays, startTime: input.startTime || null, endTime: input.endTime || null,
        rate: input.rate, depositAmount: input.depositAmount || 0, currency: property.baseCurrency, createdBy: userId,
      },
    });
    await tx.eventBooking.createMany({ data: occurrenceWindows.map((window) => ({ eventId: event.id, hallId: hall.id, startTime: window.startTime, endTime: window.endTime, status: 'ACTIVE' })) });
    const schedules = buildSchedules({ startDate, endDate, rate: input.rate, usageFrequency: input.usageFrequency, billingFrequency: input.billingFrequency, usageDays, billingDates: customBillingDates });
    if (!schedules.length) throw new Error('The lease produces no billable usage dates.');
    await tx.leaseBillingSchedule.createMany({ data: schedules.map((schedule) => ({ leaseContractId: contract.id, ...schedule })) });
    return tx.leaseContract.findUnique({ where: { id: contract.id }, include: { schedules: true, hall: true, corporateAccount: true, event: { include: { bookings: true } } } });
  });
}

/** Generates draft/submitted invoices once for due lease schedules. */
export async function processLeaseBilling(propertyId: string, actor?: { userId: string }) {
  const context = actor ? { propertyId, userId: actor.userId } : await requireEventContext();
  if (context.propertyId !== propertyId) throw new Error('Property access denied.');
  return prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found.');
    const dueSchedules = await tx.leaseBillingSchedule.findMany({
      where: { status: 'PENDING', dueDate: { lte: property.businessDate || new Date() }, leaseContract: { propertyId, isActive: true, corporateAccountId: { not: null } } },
      include: { leaseContract: { include: { hall: true, corporateAccount: { include: { cityLedgerAccount: true } } } } },
      orderBy: { dueDate: 'asc' },
    });
    const generatedInvoices = [];
    for (const schedule of dueSchedules) {
      const contract = schedule.leaseContract;
      const cityLedgerAccountId = contract.corporateAccount?.cityLedgerAccountId;
      if (!cityLedgerAccountId) throw new Error(`Lease ${contract.id} has no City Ledger account.`);
      const tax = await tx.tax.findFirst({ where: { propertyId, isActive: true, OR: [{ code: 'VAT' }, { name: { contains: 'VAT', mode: 'insensitive' } }] }, orderBy: { createdAt: 'asc' } });
      const subTotal = Number(schedule.amount);
      const totalTax = tax?.type === 'PERCENTAGE' ? subTotal * Number(tax.rate) / 100 : tax?.type === 'FLAT' ? Number(tax.rate) : 0;
      const invoice = await tx.eventInvoice.create({
        data: {
          propertyId, eventId: contract.eventId, subTotal, totalDiscount: 0, totalTax, totalAmount: subTotal + totalTax, paidAmount: 0, currency: contract.currency,
          status: 'DRAFT', workflowStatus: 'SUBMITTED', submittedBy: context.userId, submittedAt: new Date(), requestedDiscount: 0,
          cityLedgerAccountId, leaseBillingSchedule: { connect: { id: schedule.id } },
          items: { create: { description: `${contract.hall.name} lease usage (${schedule.usageCount} use${schedule.usageCount === 1 ? '' : 's'})`, category: 'HALL', quantity: schedule.usageCount, unitPrice: contract.rate, grossAmount: subTotal, discountAmount: 0, requestedDiscount: 0, discountStatus: 'APPROVED', taxAmount: totalTax, totalPrice: subTotal + totalTax, taxId: tax?.id } },
        },
        include: { items: true },
      });
      await tx.leaseBillingSchedule.update({ where: { id: schedule.id }, data: { status: 'INVOICED', invoiceId: invoice.id } });
      generatedInvoices.push(invoice);
    }
    return { processedCount: generatedInvoices.length, invoices: generatedInvoices };
  });
}
