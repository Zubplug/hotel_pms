import crypto from 'node:crypto';
import { assertCorporateCreditAvailable } from '@hotel-pms/db';
import { getOrCreateBookingSystemActor } from './system-actor';

export type CorporateEventBookingInput = {
  organizationId: string;
  propertyId: string;
  principalId: string;
  corporateAccountId: string;
  idempotencyKey: string;
  requestType: 'HALL_ONLY' | 'HALL_AND_EVENT';
  hallId: string;
  startAt: Date;
  endAt: Date;
  expectedGuests: number;
  eventName?: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  paymentMode: 'PAY_LATER' | 'DEPOSIT' | 'FULL';
};

function fingerprint(input: CorporateEventBookingInput) {
  return crypto.createHash('sha256').update(JSON.stringify({
    propertyId: input.propertyId, corporateAccountId: input.corporateAccountId,
    requestType: input.requestType, hallId: input.hallId,
    startAt: input.startAt.toISOString(), endAt: input.endAt.toISOString(),
    expectedGuests: input.expectedGuests, eventName: input.eventName?.trim() || null,
    contactEmail: input.contactEmail.toLowerCase(), paymentMode: input.paymentMode,
  })).digest('hex');
}

function validate(input: CorporateEventBookingInput) {
  if (!['PAY_LATER', 'DEPOSIT', 'FULL'].includes(input.paymentMode)) throw new Error('INVALID_PAYMENT_MODE');
  if (!Number.isInteger(input.expectedGuests) || input.expectedGuests < 1) throw new Error('INVALID_GUEST_COUNT');
  if (!input.contactName.trim() || !input.contactEmail.includes('@')) throw new Error('INVALID_CONTACT');
  if (!Number.isFinite(input.startAt.getTime()) || !Number.isFinite(input.endAt.getTime()) || input.endAt <= input.startAt || input.startAt <= new Date()) throw new Error('INVALID_DATE_RANGE');
  if (input.requestType === 'HALL_AND_EVENT' && !input.eventName?.trim()) throw new Error('EVENT_NAME_REQUIRED');
}

export async function createCorporateEventBooking(db: any, input: CorporateEventBookingInput) {
  validate(input);
  const requestFingerprint = fingerprint(input);
  const existing = await db.bookingRequest.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.propertyId !== input.propertyId || existing.operation !== 'CORPORATE_EVENT' || existing.requestFingerprint !== requestFingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
    if (existing.status === 'COMPLETED' && existing.reservationIds) return { ...(existing.reservationIds as any), idempotent: true };
    if (existing.status === 'PROCESSING') throw new Error('REQUEST_PROCESSING');
    throw new Error(existing.errorMessage || 'This request could not be completed.');
  }

  const actorId = await getOrCreateBookingSystemActor(db, input.organizationId);
  return db.$transaction(async (tx: any) => {
    await tx.bookingRequest.create({ data: { idempotencyKey: input.idempotencyKey, propertyId: input.propertyId, principalId: input.principalId, operation: 'CORPORATE_EVENT', requestFingerprint, status: 'PROCESSING' } });
    try {
      const account = await tx.corporateAccount.findFirst({ where: { id: input.corporateAccountId, organizationId: input.organizationId, propertyId: input.propertyId, isActive: true }, include: { cityLedgerAccount: true } });
      if (!account?.cityLedgerAccount || account.cityLedgerAccount.status !== 'ACTIVE') throw new Error('CORPORATE_ACCOUNT_UNAVAILABLE');
      const hall = await tx.hall.findFirst({ where: { id: input.hallId, propertyId: input.propertyId, isActive: true } });
      if (!hall || input.expectedGuests > hall.capacity || hall.rate == null) throw new Error('HALL_UNAVAILABLE');

      const conflicts = await tx.eventBooking.findMany({
        where: { hallId: hall.id, status: 'ACTIVE', startTime: { lt: input.endAt }, endTime: { gt: input.startAt }, event: { status: { not: 'CANCELLED' } } },
        select: { id: true, startTime: true, endTime: true, setupBufferMinutes: true, teardownBufferMinutes: true },
      });
      const conflict = conflicts.some((row: any) => {
        const start = new Date(row.startTime).getTime() - Number(row.setupBufferMinutes || 0) * 60000;
        const end = new Date(row.endTime).getTime() + Number(row.teardownBufferMinutes || 0) * 60000;
        return start < input.endAt.getTime() && end > input.startAt.getTime();
      });
      if (conflict) throw new Error('HALL_NO_LONGER_AVAILABLE');

      const total = Number(hall.rate);
      const requiredPayment = input.paymentMode === 'FULL' ? total : input.paymentMode === 'DEPOSIT' ? Math.round(total * 0.5 * 100) / 100 : 0;
      if (input.paymentMode === 'PAY_LATER') await assertCorporateCreditAvailable(tx, { corporateAccountId: account.id, propertyId: input.propertyId, additionalAmount: total });

      const event = await tx.event.create({ data: { propertyId: input.propertyId, name: input.eventName?.trim() || `${hall.name} booking`, contactName: input.contactName.trim(), contactEmail: input.contactEmail.toLowerCase(), contactPhone: input.contactPhone?.trim() || null, corporateAccountId: account.id, status: 'TENTATIVE', financialStatus: input.paymentMode === 'PAY_LATER' ? 'AR_OUTSTANDING' : input.paymentMode === 'DEPOSIT' ? 'DEPOSIT_DUE' : 'QUOTE', startDate: input.startAt, endDate: input.endAt, expectedGuests: input.expectedGuests } });
      await tx.eventBooking.create({ data: { eventId: event.id, hallId: hall.id, startTime: input.startAt, endTime: input.endAt, setupBufferMinutes: 60, teardownBufferMinutes: 60 } });
      const invoice = await tx.eventInvoice.create({ data: { eventId: event.id, propertyId: input.propertyId, cityLedgerAccountId: account.cityLedgerAccount.id, subTotal: total, totalDiscount: 0, totalTax: 0, totalAmount: total, paidAmount: 0, currency: account.cityLedgerAccount.currency, status: 'UNPAID', workflowStatus: 'ISSUED', issuedBy: actorId, issuedAt: new Date(), items: { create: { description: `${hall.name} venue hire`, category: 'HALL', quantity: 1, unitPrice: total, grossAmount: total, totalPrice: total, taxAmount: 0 } } } });
      const invoiceNumber = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
      const cityInvoice = await tx.cityLedgerInvoice.create({ data: { propertyId: input.propertyId, accountId: account.cityLedgerAccount.id, eventInvoiceId: invoice.id, invoiceNumber, issueDate: new Date(), dueDate: new Date(), description: `Corporate event booking: ${event.name}`, amount: total, outstandingAmount: total, paidAmount: 0, currency: invoice.currency, createdBy: actorId } });
      await tx.cityLedgerEntry.create({ data: { accountId: account.cityLedgerAccount.id, propertyId: input.propertyId, amount: total, currency: invoice.currency, type: 'TRANSFER_IN', status: 'OPEN', reference: invoiceNumber, reason: `Corporate event booking ${event.id}`, invoiceId: cityInvoice.id, createdBy: actorId } });
      await tx.cityLedgerAccount.update({ where: { id: account.cityLedgerAccount.id }, data: { balance: { increment: total } } });

      let approvalId: string | null = null;
      if (input.paymentMode === 'PAY_LATER') {
        const approval = await tx.approvalRequest.create({ data: { propertyId: input.propertyId, type: 'CORPORATE_CREDIT', requestedBy: actorId, amount: total, currency: invoice.currency, reason: `Corporate hall/event booking for ${event.name}`, details: { eventId: event.id, eventInvoiceId: invoice.id, corporateAccountId: account.id, requestType: input.requestType }, snapshot: { eventId: event.id, hallId: hall.id, amount: total, contactEmail: input.contactEmail }, idempotencyKey: `corporate-event:${input.idempotencyKey}`, expiresAt: input.startAt } });
        approvalId = approval.id;
      }
      await tx.auditLog.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, userId: actorId, userEmail: 'booking.system@lodgecore.internal', userRole: 'SYSTEM', action: 'CORPORATE_EVENT_BOOKING_CREATED', resource: 'Event', resourceId: event.id, newValue: { hallId: hall.id, invoiceId: invoice.id, cityLedgerInvoiceId: cityInvoice.id, paymentMode: input.paymentMode, requiredPayment, approvalId }, requestId: crypto.randomUUID(), ipAddress: '0.0.0.0', userAgent: 'CorporatePortal' } });
      const result = { eventId: event.id, eventInvoiceId: invoice.id, cityLedgerInvoiceId: cityInvoice.id, approvalId, status: input.paymentMode === 'PAY_LATER' ? 'PENDING_APPROVAL' : 'PENDING_PAYMENT', paymentRequired: requiredPayment > 0, amount: total, requiredPayment, currency: invoice.currency };
      await tx.bookingRequest.update({ where: { idempotencyKey: input.idempotencyKey }, data: { status: 'COMPLETED', reservationIds: result } });
      return { ...result, idempotent: false };
    } catch (error: any) {
      await tx.bookingRequest.update({ where: { idempotencyKey: input.idempotencyKey }, data: { status: 'FAILED', errorMessage: error?.message || 'Corporate event booking failed' } });
      throw error;
    }
  }, { isolationLevel: 'Serializable', timeout: 30000 });
}

export async function getCorporateEventBooking(db: any, input: { eventId: string; propertyId: string; corporateAccountId: string }) {
  return db.event.findFirst({ where: { id: input.eventId, propertyId: input.propertyId, corporateAccountId: input.corporateAccountId }, include: { bookings: { include: { hall: true } }, invoices: { include: { cityLedgerInvoice: true, payments: { select: { id: true, amount: true, status: true } } } } } });
}
