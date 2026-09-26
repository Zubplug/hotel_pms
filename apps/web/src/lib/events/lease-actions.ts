'use server';

import { prisma } from '@hotel-pms/db';
import { requireEventContext, requireEventRole } from './access';

type LeaseFrequency = 'PER_USE' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'YEARLY' | 'CUSTOM';
type UsageFrequency = 'PER_USE' | 'DAILY' | 'WEEKLY';
type SegmentInput = { hallId: string; usageDays: number[]; startTime: string; endTime: string; rate: number };

const dateOnly = (value: Date) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
const addDays = (value: Date, days: number) => new Date(value.getTime() + days * 86400000);
const addMonths = (value: Date, months: number) => new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, value.getUTCDate()));
const nextPeriodEnd = (start: Date, frequency: LeaseFrequency) => frequency === 'WEEKLY'
  ? addDays(start, 6) : frequency === 'MONTHLY' ? addDays(addMonths(start, 1), -1)
    : frequency === 'QUARTERLY' ? addDays(addMonths(start, 3), -1)
      : frequency === 'YEARLY' ? addDays(addMonths(start, 12), -1) : start;

function usageDates(start: Date, end: Date, frequency: UsageFrequency, days: number[]) {
  if (frequency === 'PER_USE') return [start];
  const dates: Date[] = [];
  for (let cursor = start; cursor <= end; cursor = addDays(cursor, 1)) {
    if (frequency === 'DAILY' || days.includes(cursor.getUTCDay())) dates.push(cursor);
  }
  return dates;
}

function atTime(day: Date, value: string, fallback: string) {
  const time = value || fallback;
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) throw new Error('Lease times must use HH:mm format.');
  return new Date(Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), Number(match[1]), Number(match[2])));
}

function buildPeriods(input: { startDate: Date; endDate: Date; billingFrequency: LeaseFrequency; billingDates?: Date[] }) {
  const periods: { periodStart: Date; periodEnd: Date; dueDate: Date }[] = [];
  if (input.billingFrequency === 'PER_USE') return [{ periodStart: input.startDate, periodEnd: input.startDate, dueDate: input.startDate }];
  if (input.billingFrequency === 'CUSTOM') {
    let periodStart = input.startDate;
    for (const dueDate of input.billingDates || []) {
      const periodEnd = dueDate < input.endDate ? dueDate : input.endDate;
      if (periodStart <= periodEnd) periods.push({ periodStart, periodEnd, dueDate });
      periodStart = addDays(periodEnd, 1);
    }
    if (periodStart <= input.endDate) periods.push({ periodStart, periodEnd: input.endDate, dueDate: input.endDate });
    return periods;
  }
  let periodStart = input.startDate;
  while (periodStart <= input.endDate) {
    const periodEnd = new Date(Math.min(nextPeriodEnd(periodStart, input.billingFrequency).getTime(), input.endDate.getTime()));
    periods.push({ periodStart, periodEnd, dueDate: periodStart });
    periodStart = addDays(periodEnd, 1);
  }
  return periods;
}

function normaliseSegments(input: { segments?: SegmentInput[]; hallId: string; usageDays?: number[]; startTime?: string; endTime?: string; rate: number; usageFrequency: UsageFrequency }, startDate: Date): SegmentInput[] {
  const raw = input.segments?.length ? input.segments : [{ hallId: input.hallId, usageDays: input.usageDays || [startDate.getUTCDay()], startTime: input.startTime || '09:00', endTime: input.endTime || '17:00', rate: input.rate }];
  return raw.map((segment) => {
    const usageDays = [...new Set((segment.usageDays || []).map(Number))].filter((day) => day >= 0 && day <= 6);
    if (!segment.hallId || !Number.isFinite(segment.rate) || segment.rate <= 0) throw new Error('Each lease segment needs a hall and a rate greater than zero.');
    const startTime = segment.startTime || '09:00';
    const endTime = segment.endTime || '17:00';
    if (atTime(startDate, endTime, '17:00') <= atTime(startDate, startTime, '09:00')) throw new Error('Each lease segment end time must be after its start time.');
    if (!usageDays.length && input.usageFrequency !== 'DAILY' && input.usageFrequency !== 'PER_USE') throw new Error('Select at least one usage day for each lease segment.');
    return { hallId: segment.hallId, usageDays, startTime, endTime, rate: segment.rate };
  });
}

export async function createLeaseContract(input: {
  propertyId: string; corporateAccountId: string; hallId: string;
  segments?: SegmentInput[];
  startDate: Date; endDate: Date; usageFrequency: UsageFrequency; billingFrequency: LeaseFrequency;
  customBillingDates?: Date[]; usageDays?: number[]; startTime?: string; endTime?: string; rate: number;
  depositAmount?: number; contactName?: string; contactEmail?: string;
}) {
  const { propertyId, userId } = await requireEventRole('FNB');
  if (propertyId !== input.propertyId) throw new Error('Property access denied.');
  const startDate = dateOnly(input.startDate); const endDate = dateOnly(input.endDate);
  if (endDate < startDate) throw new Error('Lease end date must be after the start date.');
  if (!['PER_USE', 'DAILY', 'WEEKLY'].includes(input.usageFrequency) || !['PER_USE', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'].includes(input.billingFrequency)) throw new Error('Invalid lease frequency.');
  if (input.usageFrequency === 'PER_USE' && input.billingFrequency !== 'PER_USE') throw new Error('A single/per-use contract must be billed per use.');
  const customBillingDates = [...new Set((input.customBillingDates || []).map(dateOnly).map((date) => date.toISOString()))].map((value) => new Date(value)).sort((a, b) => a.getTime() - b.getTime());
  if (input.billingFrequency === 'CUSTOM' && !customBillingDates.length) throw new Error('Custom billing requires at least one billing date.');
  if (customBillingDates.some((date) => date < startDate || date > endDate)) throw new Error('Custom billing dates must fall within the contract period.');
  const segments = normaliseSegments(input, startDate);
  return prisma.$transaction(async (tx) => {
    const [property, halls, corporate] = await Promise.all([
      tx.property.findFirst({ where: { id: propertyId } }),
      tx.hall.findMany({ where: { id: { in: segments.map((segment) => segment.hallId) }, propertyId, isActive: true } }),
      tx.corporateAccount.findFirst({ where: { id: input.corporateAccountId, propertyId }, include: { cityLedgerAccount: true } }),
    ]);
    if (!property || halls.length !== new Set(segments.map((segment) => segment.hallId)).size) throw new Error('One or more selected halls are unavailable at this property.');
    if (!corporate?.cityLedgerAccountId || corporate.cityLedgerAccount?.status !== 'ACTIVE') throw new Error('Corporate account must have an active City Ledger account.');
    const contactName = input.contactName?.trim() || corporate.contactPerson?.trim() || corporate.name;
    const contactEmail = input.contactEmail?.trim() || corporate.contactEmail || null;
    const hallById = new Map(halls.map((hall) => [hall.id, hall]));
    const occurrences: { segment: SegmentInput; startTime: Date; endTime: Date }[] = [];
    for (const segment of segments) {
      const dates = usageDates(startDate, endDate, input.usageFrequency, segment.usageDays);
      for (const day of dates) occurrences.push({ segment, startTime: atTime(day, segment.startTime, '09:00'), endTime: atTime(day, segment.endTime, '17:00') });
    }
    if (!occurrences.length) throw new Error('The lease produces no hall usage dates.');
    for (const occurrence of occurrences) {
      const conflict = await tx.eventBooking.findFirst({ where: { hallId: occurrence.segment.hallId, status: 'ACTIVE', startTime: { lt: occurrence.endTime }, endTime: { gt: occurrence.startTime } }, select: { id: true } });
      if (conflict) throw new Error(`Hall ${hallById.get(occurrence.segment.hallId)?.name || ''} is already booked during one of the requested periods.`);
    }
    const first = occurrences.reduce((a, b) => a.startTime < b.startTime ? a : b);
    const last = occurrences.reduce((a, b) => a.endTime > b.endTime ? a : b);
    const event = await tx.event.create({ data: {
      propertyId, name: `${corporate.name} — recurring hall use`, contactName, contactEmail,
      corporateAccountId: corporate.id, status: 'CONFIRMED', financialStatus: 'QUOTE', startDate: first.startTime, endDate: last.endTime, expectedGuests: 1,
      recurrenceRule: { frequency: input.usageFrequency, segments: segments.map((segment) => ({ hallId: segment.hallId, daysOfWeek: segment.usageDays, startTime: segment.startTime, endTime: segment.endTime })), until: endDate.toISOString().slice(0, 10) },
    } });
    const firstSegment = segments[0];
    const contract = await tx.leaseContract.create({ data: {
      propertyId, corporateAccountId: corporate.id, hallId: firstSegment.hallId, eventId: event.id, contactName, contactEmail,
      startDate, endDate, usageFrequency: input.usageFrequency, billingFrequency: input.billingFrequency, billingDates: customBillingDates.map((date) => date.toISOString().slice(0, 10)), usageDays: firstSegment.usageDays, startTime: firstSegment.startTime, endTime: firstSegment.endTime,
      rate: firstSegment.rate, depositAmount: input.depositAmount || 0, currency: property.baseCurrency, createdBy: userId,
    } });
    await tx.leaseContractSegment.createMany({ data: segments.map((segment) => ({ leaseContractId: contract.id, hallId: segment.hallId, usageDays: segment.usageDays, startTime: segment.startTime, endTime: segment.endTime, rate: segment.rate })) });
    await tx.eventBooking.createMany({ data: occurrences.map((occurrence) => ({ eventId: event.id, hallId: occurrence.segment.hallId, startTime: occurrence.startTime, endTime: occurrence.endTime, status: 'ACTIVE' })) });
    const createdSegments = await tx.leaseContractSegment.findMany({ where: { leaseContractId: contract.id }, orderBy: { createdAt: 'asc' } });
    const segmentByKey = new Map(createdSegments.map((segment) => [`${segment.hallId}|${segment.startTime}|${segment.endTime}|${JSON.stringify(segment.usageDays)}`, segment]));
    for (const period of buildPeriods({ startDate, endDate, billingFrequency: input.billingFrequency, billingDates: customBillingDates })) {
      const lines = segments.map((segment) => ({ segment, segmentRecord: segmentByKey.get(`${segment.hallId}|${segment.startTime}|${segment.endTime}|${JSON.stringify(segment.usageDays)}`)!, usageCount: usageDates(period.periodStart, period.periodEnd, input.usageFrequency, segment.usageDays).length }));
      const billable = lines.filter((line) => line.usageCount > 0).map((line) => ({ ...line, amount: line.usageCount * line.segment.rate }));
      if (!billable.length) continue;
      const total = billable.reduce((sum, line) => sum + line.amount, 0);
      await tx.leaseBillingSchedule.create({ data: { leaseContractId: contract.id, ...period, usageCount: billable.reduce((sum, line) => sum + line.usageCount, 0), amount: total, lines: { create: billable.map((line) => ({ segmentId: line.segmentRecord.id, usageCount: line.usageCount, amount: line.amount })) } } });
    }
    return tx.leaseContract.findUnique({ where: { id: contract.id }, include: { schedules: { include: { lines: true } }, segments: { include: { hall: true } }, hall: true, corporateAccount: true, event: { include: { bookings: true } } } });
  });
}

/** Generates one draft/submitted invoice per due period, with one line per hall segment. */
export async function processLeaseBilling(propertyId: string, actor?: { userId: string }, scheduleId?: string) {
  const context = actor ? { propertyId, userId: actor.userId } : await requireEventContext();
  if (context.propertyId !== propertyId) throw new Error('Property access denied.');
  return prisma.$transaction(async (tx) => {
    const property = await tx.property.findUnique({ where: { id: propertyId } });
    if (!property) throw new Error('Property not found.');
    const dueSchedules = await tx.leaseBillingSchedule.findMany({
      where: { status: 'PENDING', ...(scheduleId ? { id: scheduleId } : { dueDate: { lte: property.businessDate || new Date() } }), leaseContract: { propertyId, isActive: true, corporateAccountId: { not: null } } },
      include: { lines: { include: { segment: { include: { hall: true } } } }, leaseContract: { include: { corporateAccount: { include: { cityLedgerAccount: true } } } } }, orderBy: { dueDate: 'asc' },
    });
    const generatedInvoices = [];
    for (const schedule of dueSchedules) {
      const contract = schedule.leaseContract;
      const cityLedgerAccountId = contract.corporateAccount?.cityLedgerAccountId;
      if (!cityLedgerAccountId) throw new Error(`Lease ${contract.id} has no City Ledger account.`);
      const tax = await tx.tax.findFirst({ where: { propertyId, isActive: true, OR: [{ code: 'VAT' }, { name: { contains: 'VAT', mode: 'insensitive' } }] }, orderBy: { createdAt: 'asc' } });
      const subTotal = Number(schedule.amount);
      const totalTax = tax?.type === 'PERCENTAGE' ? subTotal * Number(tax.rate) / 100 : tax?.type === 'FLAT' ? Number(tax.rate) : 0;
      const items = schedule.lines.map((line) => { const gross = Number(line.amount); const lineTax = subTotal ? totalTax * gross / subTotal : 0; return { description: `${line.segment.hall.name} lease usage (${line.usageCount} use${line.usageCount === 1 ? '' : 's'})`, category: 'HALL', quantity: line.usageCount, unitPrice: line.segment.rate, grossAmount: gross, discountAmount: 0, requestedDiscount: 0, discountStatus: 'APPROVED', taxAmount: lineTax, totalPrice: gross + lineTax, taxId: tax?.id }; });
      const invoice = await tx.eventInvoice.create({ data: {
        propertyId, eventId: contract.eventId, subTotal, totalDiscount: 0, totalTax, totalAmount: subTotal + totalTax, paidAmount: 0, currency: contract.currency,
        status: 'DRAFT', workflowStatus: 'SUBMITTED', submittedBy: context.userId, submittedAt: new Date(), requestedDiscount: 0, cityLedgerAccountId,
        leaseBillingSchedule: { connect: { id: schedule.id } }, items: { create: items },
      }, include: { items: true } });
      await tx.leaseBillingSchedule.update({ where: { id: schedule.id }, data: { status: 'INVOICED', invoiceId: invoice.id } });
      generatedInvoices.push(invoice);
    }
    return { processedCount: generatedInvoices.length, invoices: generatedInvoices };
  });
}

/** Allows F&B to submit a selected pending lease period before its normal due date. */
export async function submitLeaseBillingSchedule(scheduleId: string) {
  const { propertyId, userId } = await requireEventRole('FNB');
  const result = await processLeaseBilling(propertyId, { userId }, scheduleId);
  if (result.processedCount !== 1) throw new Error('This lease period is no longer pending or is not available for this property.');
  return result.invoices[0];
}
