import crypto from 'node:crypto';
import { assertCorporateCreditAvailable } from '@hotel-pms/db';
import { getOrCreateBookingSystemActor } from './system-actor';
import { getCorporateEventQuote, getCorporateHallPricing } from './corporate-event-quote-service';

export type CorporateEventBookingInput = {
  organizationId: string;
  propertyId: string;
  principalId: string;
  corporateAccountId: string;
  quoteId: string;
  idempotencyKey: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
};

function fingerprint(input: CorporateEventBookingInput) {
  return crypto.createHash('sha256').update(JSON.stringify({
    propertyId: input.propertyId,
    corporateAccountId: input.corporateAccountId,
    quoteId: input.quoteId,
    contactName: input.contactName.trim(),
    contactEmail: input.contactEmail.toLowerCase(),
    contactPhone: input.contactPhone?.trim() || null,
  })).digest('hex');
}

function validate(input: CorporateEventBookingInput) {
  if (!input.quoteId) throw new Error('QUOTE_REQUIRED');
  if (!input.contactName.trim() || !input.contactEmail.includes('@')) throw new Error('INVALID_CONTACT');
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
      const quote = await getCorporateEventQuote(tx, { id: input.quoteId, organizationId: input.organizationId, propertyId: input.propertyId, principalId: input.principalId, corporateAccountId: account.id });
      const snapshot = quote.snapshot as any;
      if (snapshot?.kind !== 'CORPORATE_EVENT_HALL') throw new Error('QUOTE_TAMPERED');
      const request = snapshot.request;
      const hall = await tx.hall.findFirst({ where: { id: request.hallId, propertyId: input.propertyId, isActive: true } });
      if (!hall || request.expectedGuests > hall.capacity || hall.rate == null) throw new Error('HALL_NO_LONGER_AVAILABLE');
      const conflicts = await tx.eventBooking.findMany({ where: { hallId: hall.id, status: 'ACTIVE', startTime: { lt: new Date(request.endAt) }, endTime: { gt: new Date(request.startAt) }, event: { status: { not: 'CANCELLED' } } }, select: { startTime: true, endTime: true, setupBufferMinutes: true, teardownBufferMinutes: true } });
      if (conflicts.some((row: any) => new Date(row.startTime).getTime() - Number(row.setupBufferMinutes || 0) * 60000 < new Date(request.endAt).getTime() && new Date(row.endTime).getTime() + Number(row.teardownBufferMinutes || 0) * 60000 > new Date(request.startAt).getTime())) throw new Error('HALL_NO_LONGER_AVAILABLE');
      const currentPricing = await getCorporateHallPricing(tx, { ...request, organizationId: input.organizationId, principalId: input.principalId, corporateAccountId: account.id, startAt: new Date(request.startAt), endAt: new Date(request.endAt) }, hall);
      if (Number(currentPricing.corporateRate) !== Number(snapshot.pricing.corporateRate)) throw new Error('QUOTE_PRICE_CHANGED');
      const total = Number(snapshot.pricing.total);
      const standardRate = Number(snapshot.pricing.standardRate);
      const discountAmount = Number(snapshot.pricing.discountAmount || 0);
      const paymentMode = request.paymentMode;
      const requiredPayment = paymentMode === 'FULL' ? total : paymentMode === 'DEPOSIT' ? Math.round(total * 0.5 * 100) / 100 : 0;
      if (paymentMode === 'PAY_LATER') await assertCorporateCreditAvailable(tx, { corporateAccountId: account.id, propertyId: input.propertyId, additionalAmount: total });

      const event = await tx.event.create({ data: { propertyId: input.propertyId, name: request.eventName?.trim() || `${hall.name} booking`, contactName: input.contactName.trim(), contactEmail: input.contactEmail.toLowerCase(), contactPhone: input.contactPhone?.trim() || null, corporateAccountId: account.id, status: 'TENTATIVE', financialStatus: paymentMode === 'PAY_LATER' ? 'AR_OUTSTANDING' : paymentMode === 'DEPOSIT' ? 'DEPOSIT_DUE' : 'QUOTE', startDate: new Date(request.startAt), endDate: new Date(request.endAt), expectedGuests: request.expectedGuests } });
      await tx.eventBooking.create({ data: { eventId: event.id, hallId: hall.id, startTime: new Date(request.startAt), endTime: new Date(request.endAt), setupBufferMinutes: 60, teardownBufferMinutes: 60 } });
      const invoice = await tx.eventInvoice.create({ data: { eventId: event.id, propertyId: input.propertyId, cityLedgerAccountId: account.cityLedgerAccount.id, subTotal: standardRate, totalDiscount: discountAmount, totalTax: 0, totalAmount: total, paidAmount: 0, currency: snapshot.pricing.currency || account.cityLedgerAccount.currency, status: 'UNPAID', workflowStatus: 'ISSUED', issuedBy: actorId, issuedAt: new Date(), items: { create: { description: `${hall.name} venue hire`, category: 'HALL', quantity: 1, unitPrice: standardRate, grossAmount: standardRate, requestedDiscount: discountAmount, discountAmount, discountReason: 'Approved corporate hall pricing', discountStatus: 'APPROVED', totalPrice: total, taxAmount: 0 } } } });
      const invoiceNumber = `INV-${invoice.id.slice(0, 8).toUpperCase()}`;
      const cityInvoice = await tx.cityLedgerInvoice.create({ data: { propertyId: input.propertyId, accountId: account.cityLedgerAccount.id, eventInvoiceId: invoice.id, invoiceNumber, issueDate: new Date(), dueDate: new Date(), description: `Corporate event booking: ${event.name}`, amount: total, outstandingAmount: total, paidAmount: 0, currency: invoice.currency, createdBy: actorId } });
      await tx.cityLedgerEntry.create({ data: { accountId: account.cityLedgerAccount.id, propertyId: input.propertyId, amount: total, currency: invoice.currency, type: 'TRANSFER_IN', status: 'OPEN', reference: invoiceNumber, reason: `Corporate event booking ${event.id}`, invoiceId: cityInvoice.id, createdBy: actorId } });
      await tx.cityLedgerAccount.update({ where: { id: account.cityLedgerAccount.id }, data: { balance: { increment: total } } });
      let approvalId: string | null = null;
      if (paymentMode === 'PAY_LATER') {
        const approval = await tx.approvalRequest.create({ data: { propertyId: input.propertyId, type: 'CORPORATE_CREDIT', requestedBy: actorId, amount: total, currency: invoice.currency, reason: `Corporate hall/event booking for ${event.name}`, details: { eventId: event.id, eventInvoiceId: invoice.id, corporateAccountId: account.id, requestType: request.requestType, discountAmount }, snapshot: { eventId: event.id, hallId: hall.id, amount: total, standardRate, discountAmount, contactEmail: input.contactEmail }, idempotencyKey: `corporate-event:${input.idempotencyKey}`, expiresAt: new Date(request.startAt) } });
        approvalId = approval.id;
      }
      await tx.bookingQuote.update({ where: { id: quote.id }, data: { status: 'CONSUMED', consumedAt: new Date(), reservationId: event.id } });
      await tx.auditLog.create({ data: { organizationId: input.organizationId, propertyId: input.propertyId, userId: actorId, userEmail: 'booking.system@lodgecore.internal', userRole: 'SYSTEM', action: 'CORPORATE_EVENT_BOOKING_CREATED', resource: 'Event', resourceId: event.id, newValue: { hallId: hall.id, invoiceId: invoice.id, cityLedgerInvoiceId: cityInvoice.id, paymentMode, requiredPayment, standardRate, discountAmount, approvalId }, requestId: crypto.randomUUID(), ipAddress: '0.0.0.0', userAgent: 'CorporatePortal' } });
      const result = { eventId: event.id, eventInvoiceId: invoice.id, cityLedgerInvoiceId: cityInvoice.id, approvalId, status: paymentMode === 'PAY_LATER' ? 'PENDING_APPROVAL' : 'PENDING_PAYMENT', paymentRequired: requiredPayment > 0, amount: total, requiredPayment, standardRate, discountAmount, currency: invoice.currency };
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
