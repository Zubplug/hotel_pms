import type { Prisma, PrismaClient } from '@hotel-pms/db';
import { GLMappingService } from '../services/gl-mapping-service';
import { GeneralLedgerService } from '../services/general-ledger-service';
import { attachReservationToCorporateFolio, materializeCorporateAccountForApplication } from '@hotel-pms/db';

type TxClient = Prisma.TransactionClient | PrismaClient | any;

export class CorporateSettlementError extends Error {
  constructor(
    readonly code:
      | 'TRANSACTION_NOT_FOUND'
      | 'NOT_CORPORATE_TRANSACTION'
      | 'CORPORATE_ACCOUNT_MISMATCH'
      | 'CITY_LEDGER_UNAVAILABLE'
      | 'ALREADY_SETTLED',
    message: string,
  ) {
    super(message);
    this.name = 'CorporateSettlementError';
  }
}

export type CorporateSettlementLock = Readonly<{
  bookingPaymentTransaction: any;
  reservation: any;
  corporateAccount: any;
  cityLedgerAccount: any;
  paymentGroup: any | null;
  settlementIdentity: string;
}>;

export type CorporateSettlementResult = Readonly<{
  paymentId: string;
  cityLedgerEntryId: string;
  reservationId: string;
  reservationConfirmed: boolean;
  amount: number;
  currency: string;
}>;

/**
 * Locks the records that define a corporate gateway settlement.
 *
 * Lock order is deliberately fixed:
 *   1. BookingPaymentTransaction
 *   2. CityLedgerAccount
 *
 * Corporate webhook retries must call this inside their database transaction
 * before checking or creating Payment, CityLedgerEntry, or GL records. Public
 * Booking Engine transactions never call this boundary.
 */
export async function lockCorporateSettlement(
  tx: TxClient,
  bookingPaymentTransactionId: string,
  actorId?: string,
): Promise<CorporateSettlementLock> {
  const lockedTransaction = await tx.$queryRaw<any[]>`
    SELECT id
    FROM "BookingPaymentTransaction"
    WHERE id = ${bookingPaymentTransactionId}::uuid
    FOR UPDATE
  `;
  if (!lockedTransaction[0]) {
    throw new CorporateSettlementError('TRANSACTION_NOT_FOUND', 'Payment transaction not found');
  }

  const bookingPaymentTransaction = await tx.bookingPaymentTransaction.findUnique({
    where: { id: bookingPaymentTransactionId },
    include: {
      reservation: {
        select: {
          id: true,
          propertyId: true,
          corporateAccountId: true,
          corporateBookingApplicationId: true,
          ratePlanId: true,
          status: true,
          currency: true,
          property: { select: { organizationId: true } },
        },
      },
    },
  });
  if (!bookingPaymentTransaction) {
    throw new CorporateSettlementError('TRANSACTION_NOT_FOUND', 'Payment transaction not found');
  }

  const metadata = (bookingPaymentTransaction.metadata || {}) as Record<string, unknown>;
  if (metadata.channel !== 'CORPORATE_API') {
    throw new CorporateSettlementError('NOT_CORPORATE_TRANSACTION', 'Payment transaction is not a corporate settlement');
  }

  if (bookingPaymentTransaction.cityLedgerEntryId) {
    throw new CorporateSettlementError('ALREADY_SETTLED', 'Corporate payment transaction is already settled');
  }

  let paymentGroup = null;
  if (bookingPaymentTransaction.corporatePaymentGroupId) {
    // Group lock follows the payment-transaction lock. This serializes two
    // different gateway transactions paying the same corporate booking.
    await tx.$queryRaw<any[]>`
      SELECT id
      FROM "CorporatePaymentGroup"
      WHERE id = ${bookingPaymentTransaction.corporatePaymentGroupId}::uuid
      FOR UPDATE
    `;
    paymentGroup = await tx.corporatePaymentGroup.findUnique({
      where: { id: bookingPaymentTransaction.corporatePaymentGroupId },
      include: { reservations: { select: { reservationId: true, amountRequired: true } } },
    });
  }

  const reservation = bookingPaymentTransaction.reservation;
  if (!reservation) {
    throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Corporate payment is not linked to a corporate reservation');
  }
  let corporateAccountId = reservation.corporateAccountId;
  if (!corporateAccountId && reservation.corporateBookingApplicationId) {
    const materialized = await materializeCorporateAccountForApplication(tx, {
      applicationId: reservation.corporateBookingApplicationId,
      organizationId: bookingPaymentTransaction.organizationId,
      propertyId: bookingPaymentTransaction.propertyId,
      ratePlanId: reservation.ratePlanId,
      actorId: actorId || null,
    });
    corporateAccountId = materialized?.id || null;
    if (corporateAccountId) {
      await tx.reservation.update({ where: { id: reservation.id }, data: { corporateAccountId } });
      await attachReservationToCorporateFolio(tx, { reservationId: reservation.id, propertyId: reservation.propertyId, corporateAccountId });
      reservation.corporateAccountId = corporateAccountId;
    }
  }
  if (!corporateAccountId) throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Corporate payment is not linked to a corporate account or pending application');

  const corporateAccount = await tx.corporateAccount.findUnique({
    where: { id: corporateAccountId },
    select: {
      id: true,
      organizationId: true,
      propertyId: true,
      cityLedgerAccountId: true,
      isActive: true,
    },
  });
  if (
    !corporateAccount ||
    corporateAccount.organizationId !== bookingPaymentTransaction.organizationId ||
    corporateAccount.propertyId !== bookingPaymentTransaction.propertyId ||
    reservation.propertyId !== bookingPaymentTransaction.propertyId ||
    reservation.property.organizationId !== bookingPaymentTransaction.organizationId
  ) {
    throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Corporate payment scope does not match its reservation');
  }

  if (!corporateAccount.cityLedgerAccountId || !corporateAccount.isActive) {
    throw new CorporateSettlementError('CITY_LEDGER_UNAVAILABLE', 'Corporate account has no active City Ledger account');
  }

  // Always acquire the City Ledger lock after the payment-transaction lock.
  await tx.$queryRaw<any[]>`
    SELECT id
    FROM "CityLedgerAccount"
    WHERE id = ${corporateAccount.cityLedgerAccountId}::uuid
    FOR UPDATE
  `;
  const cityLedgerAccount = await tx.cityLedgerAccount.findUnique({
    where: { id: corporateAccount.cityLedgerAccountId },
    select: { id: true, propertyId: true, organizationId: true, type: true, status: true, currency: true, balance: true },
  });
  if (
    !cityLedgerAccount ||
    cityLedgerAccount.type !== 'CORPORATE' ||
    cityLedgerAccount.status !== 'ACTIVE' ||
    cityLedgerAccount.propertyId !== bookingPaymentTransaction.propertyId ||
    cityLedgerAccount.organizationId !== bookingPaymentTransaction.organizationId
  ) {
    throw new CorporateSettlementError('CITY_LEDGER_UNAVAILABLE', 'Corporate City Ledger account is unavailable');
  }

  return {
    bookingPaymentTransaction,
    reservation,
    corporateAccount,
    cityLedgerAccount,
    paymentGroup,
    settlementIdentity: `CORP_SETTLEMENT:${bookingPaymentTransaction.id}`,
  };
}

function paymentThreshold(reservation: any, metadata: Record<string, unknown>): number {
  const snapshot = (reservation.ratePlanSnapshot || {}) as Record<string, any>;
  const mode = String(metadata.paymentMode || snapshot.paymentMode || snapshot.request?.paymentMode || '').toUpperCase();
  if (mode === 'DEPOSIT') return Number(snapshot.depositAmount ?? snapshot.pricing?.depositAmount ?? 0);
  return Number(snapshot.total ?? snapshot.totals?.total ?? 0);
}

async function allocateCorporateGatewayReceipt(input: {
  tx: TxClient;
  accountId: string;
  propertyId: string;
  paymentEntryId: string;
  amount: number;
  currency: string;
  staffId: string;
}): Promise<{ appliedAmount: number; remainingAmount: number }> {
  const invoiceIds = await input.tx.$queryRaw<Array<{ id: string }>>`
    SELECT id
    FROM "CityLedgerInvoice"
    WHERE "accountId" = ${input.accountId}::uuid
      AND "propertyId" = ${input.propertyId}::uuid
      AND "currency" = ${input.currency}
      AND "status" IN ('OPEN', 'PARTIALLY_PAID')
      AND "outstandingAmount" > 0
    ORDER BY "dueDate" ASC, "createdAt" ASC, id ASC
    FOR UPDATE
  `;
  const invoices = invoiceIds.length
    ? await input.tx.cityLedgerInvoice.findMany({ where: { id: { in: invoiceIds.map((row: { id: string }) => row.id) } }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }] })
    : [];

  let remainingAmount = input.amount;
  let appliedAmount = 0;
  for (const invoice of invoices) {
    if (remainingAmount <= 0.01) break;
    const applied = Math.min(remainingAmount, Number(invoice.outstandingAmount));
    if (applied <= 0.01) continue;
    const outstandingAmount = Number(invoice.outstandingAmount) - applied;
    await input.tx.cityLedgerInvoice.update({
      where: { id: invoice.id },
      data: {
        paidAmount: { increment: applied },
        outstandingAmount,
        status: outstandingAmount <= 0.01 ? 'PAID' : 'PARTIALLY_PAID',
      },
    });
    if (invoice.eventInvoiceId) {
      const eventInvoice = await input.tx.eventInvoice.findUnique({ where: { id: invoice.eventInvoiceId }, select: { id: true, totalAmount: true, paidAmount: true } });
      if (eventInvoice) {
        const paidAmount = Number(eventInvoice.paidAmount) + applied;
        const nextStatus = paidAmount + 0.01 >= Number(eventInvoice.totalAmount) ? 'PAID' : 'PARTIAL';
        await input.tx.eventInvoice.update({ where: { id: eventInvoice.id }, data: { paidAmount, status: nextStatus } });
        if (nextStatus === 'PAID') await input.tx.leaseBillingSchedule.updateMany({ where: { invoiceId: eventInvoice.id }, data: { status: 'PAID' } });
      }
    }
    await input.tx.cityLedgerAllocation.create({
      data: { paymentId: input.paymentEntryId, invoiceId: invoice.id, amount: applied, currency: input.currency, createdBy: input.staffId },
    });
    if (outstandingAmount <= 0.01) {
      await input.tx.cityLedgerEntry.updateMany({
        where: { invoiceId: invoice.id, type: 'TRANSFER_IN', status: 'OPEN' },
        data: { status: 'SETTLED' },
      });
    }
    remainingAmount -= applied;
    appliedAmount += applied;
  }
  return { appliedAmount, remainingAmount };
}

/**
 * Posts one verified CORPORATE_API gateway payment to the PMS City Ledger.
 * The caller must invoke this inside its outer database transaction. The
 * provider signature/verification happens before this method; this method is
 * responsible only for the atomic native accounting settlement.
 */
export async function settleCorporatePayment(input: {
  tx: TxClient;
  bookingPaymentTransactionId: string;
  providerRef: string;
  providerTransactionId: string;
  verifiedAmount: number;
  verifiedCurrency: string;
  businessDate: Date;
  systemActorId: string;
  requestId: string;
}): Promise<CorporateSettlementResult> {
  let locked: CorporateSettlementLock;
  try {
    locked = await lockCorporateSettlement(input.tx, input.bookingPaymentTransactionId, input.systemActorId);
  } catch (error) {
    if (!(error instanceof CorporateSettlementError) || error.code !== 'ALREADY_SETTLED') throw error;
    const settled = await input.tx.bookingPaymentTransaction.findUnique({
      where: { id: input.bookingPaymentTransactionId },
      select: { id: true, providerRef: true, paymentId: true, cityLedgerEntryId: true, reservationId: true, amount: true, currency: true },
    });
    const linkedEntry = settled?.cityLedgerEntryId
      ? await input.tx.cityLedgerEntry.findUnique({ where: { id: settled.cityLedgerEntryId }, select: { id: true, reference: true, amount: true, currency: true, type: true } })
      : null;
    if (!settled?.paymentId || !settled.cityLedgerEntryId || !linkedEntry || linkedEntry.type !== 'PAYMENT' || linkedEntry.reference !== `CORP_SETTLEMENT:${input.bookingPaymentTransactionId}` || settled.providerRef !== input.providerRef || settled.amount == null || String(settled.currency).toUpperCase() !== input.verifiedCurrency.toUpperCase() || String(linkedEntry.currency).toUpperCase() !== input.verifiedCurrency.toUpperCase() || Math.abs(Number(settled.amount) - input.verifiedAmount) > 0.01 || Math.abs(Number(linkedEntry.amount) - input.verifiedAmount) > 0.01) {
      throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Existing corporate settlement is inconsistent');
    }
    const reservation = await input.tx.reservation.findUnique({ where: { id: settled.reservationId }, select: { status: true } });
    return { paymentId: settled.paymentId, cityLedgerEntryId: settled.cityLedgerEntryId, reservationId: settled.reservationId, reservationConfirmed: reservation?.status === 'CONFIRMED', amount: input.verifiedAmount, currency: input.verifiedCurrency };
  }
  const bpt = locked.bookingPaymentTransaction;
  const metadata = (bpt.metadata || {}) as Record<string, unknown>;

  if (metadata.paymentTarget !== 'STANDALONE_API') {
    throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Corporate payment target is invalid');
  }
  if (bpt.providerRef !== input.providerRef) {
    throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Provider reference does not match payment transaction');
  }
  if (Math.abs(Number(bpt.amount) - input.verifiedAmount) > 0.01 || String(bpt.currency).toUpperCase() !== input.verifiedCurrency.toUpperCase()) {
    throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Verified payment amount or currency does not match the transaction');
  }
  if (!['PENDING', 'SUCCESS'].includes(locked.reservation.status)) {
    throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Corporate reservation is no longer payable');
  }

  const existingPayment = await input.tx.payment.findUnique({
    where: { idempotencyKey: locked.settlementIdentity },
    select: { id: true },
  });
  const existingEntry = await input.tx.cityLedgerEntry.findFirst({
    where: { reference: locked.settlementIdentity, accountId: locked.cityLedgerAccount.id, type: 'PAYMENT' },
    select: { id: true, amount: true, currency: true },
  });
  if (existingPayment || existingEntry) {
    if (!existingPayment || !existingEntry || Number(existingEntry.amount) !== input.verifiedAmount || String(existingEntry.currency).toUpperCase() !== input.verifiedCurrency.toUpperCase()) {
      throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Existing corporate settlement is inconsistent');
    }
    await input.tx.bookingPaymentTransaction.update({
      where: { id: bpt.id },
      data: { cityLedgerEntryId: existingEntry.id, paymentId: existingPayment.id, status: 'SUCCESS', providerTxId: input.providerTransactionId, webhookVerified: true },
    });
    return { paymentId: existingPayment.id, cityLedgerEntryId: existingEntry.id, reservationId: locked.reservation.id, reservationConfirmed: locked.reservation.status === 'CONFIRMED', amount: input.verifiedAmount, currency: input.verifiedCurrency };
  }

  const masterFolio = await input.tx.folio.findFirst({
    where: { propertyId: bpt.propertyId, type: 'CITY_LEDGER', corporateAccountId: null, reservationId: null, status: 'OPEN' },
  }) || await input.tx.folio.create({
    data: {
      propertyId: bpt.propertyId,
      type: 'CITY_LEDGER',
      status: 'OPEN',
      currency: input.verifiedCurrency,
      folioNumber: `AR-${bpt.propertyId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}`,
    },
  });

  const payment = await input.tx.payment.create({
    data: {
      folioId: masterFolio.id,
      reservationId: locked.reservation.id,
      propertyId: bpt.propertyId,
      method: 'PAYMENT_GATEWAY',
      collectionSource: 'RECEIVABLES',
      provider: bpt.provider,
      providerRef: input.providerRef,
      providerTransactionId: input.providerTransactionId,
      amount: input.verifiedAmount,
      currency: input.verifiedCurrency,
      baseAmount: input.verifiedAmount,
      status: 'COMPLETED',
      businessDate: input.businessDate,
      idempotencyKey: locked.settlementIdentity,
      receivedBy: input.systemActorId,
      notes: `Corporate City Ledger advance via ${bpt.provider}. Ref: ${input.providerRef}`,
    },
  });

  const entry = await input.tx.cityLedgerEntry.create({
    data: {
      accountId: locked.cityLedgerAccount.id,
      propertyId: bpt.propertyId,
      reservationId: locked.reservation.id,
      folioId: masterFolio.id,
      amount: input.verifiedAmount,
      currency: input.verifiedCurrency,
      type: 'PAYMENT',
      status: 'OPEN',
      reference: locked.settlementIdentity,
      reason: 'Corporate prepaid advance received through API',
      createdBy: input.systemActorId,
    },
  });
  const allocation = await allocateCorporateGatewayReceipt({
    tx: input.tx,
    accountId: locked.cityLedgerAccount.id,
    propertyId: bpt.propertyId,
    paymentEntryId: entry.id,
    amount: input.verifiedAmount,
    currency: input.verifiedCurrency,
    staffId: input.systemActorId,
  });
  if (allocation.remainingAmount <= 0.01) {
    await input.tx.cityLedgerEntry.update({ where: { id: entry.id }, data: { status: 'SETTLED', reason: 'Corporate payment allocated to outstanding invoices' } });
  }
  // Only the invoice-applied portion reduces the receivable balance. Any
  // remainder remains an unapplied corporate advance wallet credit.
  if (allocation.appliedAmount > 0.01) {
    await input.tx.cityLedgerAccount.update({ where: { id: locked.cityLedgerAccount.id }, data: { balance: { decrement: allocation.appliedAmount } } });
  }

  const paymentAssetAccountId = await GLMappingService.getAssetAccountForMethod(bpt.propertyId, 'PAYMENT_GATEWAY');
  const corporateAdvancesAccountId = await GLMappingService.getCorporateAdvancesAccount(bpt.propertyId);
  await GeneralLedgerService.postJournal(
    { userId: input.systemActorId, propertyIds: [bpt.propertyId], organizationId: bpt.organizationId, role: 'SYSTEM', permissions: [], outletIds: [] },
    {
      propertyId: bpt.propertyId,
      entryDate: input.businessDate,
      reference: locked.settlementIdentity,
      description: 'Corporate API advance received',
      sourceModule: 'AR',
      lines: [
        { accountId: paymentAssetAccountId, debit: input.verifiedAmount, credit: 0, description: 'Corporate gateway payment received', sourceType: 'CORPORATE_PAYMENT', sourceId: entry.id },
        ...(allocation.appliedAmount > 0.01 ? [{ accountId: await GLMappingService.getCityLedgerAccount(bpt.propertyId), debit: 0, credit: allocation.appliedAmount, description: 'Reduce outstanding corporate receivable', sourceType: 'CORPORATE_INVOICE_PAYMENT', sourceId: entry.id }] : []),
        ...(allocation.remainingAmount > 0.01 ? [{ accountId: corporateAdvancesAccountId, debit: 0, credit: allocation.remainingAmount, description: 'Unapplied corporate advance', sourceType: 'CORPORATE_ADVANCE', sourceId: entry.id }] : []),
      ],
    },
    input.tx,
  );

  await input.tx.folio.update({ where: { id: masterFolio.id }, data: { totalPayments: { increment: input.verifiedAmount }, balance: { decrement: input.verifiedAmount } } });
  await input.tx.bookingPaymentTransaction.update({
    where: { id: bpt.id },
    data: { cityLedgerEntryId: entry.id, paymentId: payment.id, status: 'SUCCESS', providerTxId: input.providerTransactionId, webhookVerified: true },
  });

  const settledWhere = locked.paymentGroup
    ? { corporatePaymentGroupId: locked.paymentGroup.id, status: 'SUCCESS' }
    : { reservationId: locked.reservation.id, status: 'SUCCESS' };
  const settledAmount = typeof input.tx.bookingPaymentTransaction.aggregate === 'function'
    ? Number((await input.tx.bookingPaymentTransaction.aggregate({ where: settledWhere, _sum: { amount: true } }))._sum.amount ?? 0)
    : input.verifiedAmount;
  const threshold = locked.paymentGroup
    ? Number(locked.paymentGroup.requiredAmount)
    : paymentThreshold(locked.reservation, metadata);
  const reservationConfirmed = locked.reservation.status === 'CONFIRMED' || settledAmount + 0.01 >= threshold;
  if (locked.paymentGroup) {
    await input.tx.corporatePaymentGroup.update({
      where: { id: locked.paymentGroup.id },
      data: { status: reservationConfirmed ? 'SETTLED' : 'PARTIALLY_SETTLED' },
    });
    if (reservationConfirmed) {
      await input.tx.reservation.updateMany({
        where: { id: { in: locked.paymentGroup.reservations.map((item: any) => item.reservationId) }, status: 'PENDING' },
        data: { status: 'CONFIRMED', paymentExpiresAt: null },
      });
    }
  } else if (locked.reservation.status === 'PENDING' && reservationConfirmed) {
    await input.tx.reservation.update({ where: { id: locked.reservation.id }, data: { status: 'CONFIRMED', paymentExpiresAt: null } });
  }

  await input.tx.auditLog.create({
    data: {
      organizationId: bpt.organizationId,
      propertyId: bpt.propertyId,
      userId: input.systemActorId,
      userEmail: 'booking.system@lodgecore.internal',
      userRole: 'SYSTEM',
      action: 'CORPORATE_PAYMENT_SETTLED',
      resource: 'CityLedgerEntry',
      resourceId: entry.id,
      newValue: { amount: input.verifiedAmount, appliedAmount: allocation.appliedAmount, remainingAdvance: allocation.remainingAmount, settledAmount, threshold, currency: input.verifiedCurrency, reservationId: locked.reservation.id, paymentId: payment.id, settlementIdentity: locked.settlementIdentity, reservationConfirmed },
      ipAddress: '0.0.0.0',
      userAgent: 'Corporate-Payment-Webhook',
      requestId: input.requestId,
    },
  });
  await input.tx.outboxEvent.create({
    data: {
      organizationId: bpt.organizationId,
      propertyId: bpt.propertyId,
      eventType: 'CORPORATE_PAYMENT_SETTLED',
      aggregateType: 'CITY_LEDGER_ENTRY',
      aggregateId: entry.id,
      payload: { reservationId: locked.reservation.id, paymentId: payment.id, cityLedgerEntryId: entry.id, amount: input.verifiedAmount, currency: input.verifiedCurrency, settlementIdentity: locked.settlementIdentity },
    },
  });

  return { paymentId: payment.id, cityLedgerEntryId: entry.id, reservationId: locked.reservation.id, reservationConfirmed, amount: input.verifiedAmount, currency: input.verifiedCurrency };
}

/** Settles a portal/API wallet top-up without creating a reservation. */
export async function settleCorporateAdvancePayment(input: {
  tx: TxClient;
  bookingPaymentTransactionId: string;
  providerRef: string;
  providerTransactionId: string;
  verifiedAmount: number;
  verifiedCurrency: string;
  businessDate: Date;
  systemActorId: string;
  requestId: string;
}) {
  await input.tx.$queryRaw<any[]>`SELECT id FROM "BookingPaymentTransaction" WHERE id = ${input.bookingPaymentTransactionId}::uuid FOR UPDATE`;
  const bpt = await input.tx.bookingPaymentTransaction.findUnique({ where: { id: input.bookingPaymentTransactionId } });
  if (!bpt) throw new CorporateSettlementError('TRANSACTION_NOT_FOUND', 'Payment transaction not found');
  const metadata = (bpt.metadata || {}) as Record<string, unknown>;
  if (metadata.channel !== 'CORPORATE_API' || metadata.walletCredit !== true) throw new CorporateSettlementError('NOT_CORPORATE_TRANSACTION', 'Payment transaction is not a corporate wallet credit');
  if (bpt.providerRef !== input.providerRef || Math.abs(Number(bpt.amount) - input.verifiedAmount) > 0.01 || String(bpt.currency).toUpperCase() !== input.verifiedCurrency.toUpperCase()) throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Verified wallet payment does not match the transaction');
  if (bpt.cityLedgerEntryId) return { cityLedgerEntryId: bpt.cityLedgerEntryId, amount: input.verifiedAmount, currency: input.verifiedCurrency };
  const corporateAccountId = typeof metadata.corporateAccountId === 'string' ? metadata.corporateAccountId : null;
  if (!corporateAccountId) throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Wallet payment has no corporate account');
  const corporateAccount = await input.tx.corporateAccount.findFirst({ where: { id: corporateAccountId, organizationId: bpt.organizationId, propertyId: bpt.propertyId, isActive: true }, select: { id: true, cityLedgerAccountId: true } });
  if (!corporateAccount?.cityLedgerAccountId) throw new CorporateSettlementError('CITY_LEDGER_UNAVAILABLE', 'Corporate account has no active City Ledger account');
  await input.tx.$queryRaw<any[]>`SELECT id FROM "CityLedgerAccount" WHERE id = ${corporateAccount.cityLedgerAccountId}::uuid FOR UPDATE`;
  const ledger = await input.tx.cityLedgerAccount.findUnique({ where: { id: corporateAccount.cityLedgerAccountId }, select: { id: true, propertyId: true, organizationId: true, type: true, status: true, currency: true } });
  if (!ledger || ledger.type !== 'CORPORATE' || ledger.status !== 'ACTIVE' || ledger.propertyId !== bpt.propertyId || ledger.organizationId !== bpt.organizationId) throw new CorporateSettlementError('CITY_LEDGER_UNAVAILABLE', 'Corporate City Ledger account is unavailable');

  const existingEntry = await input.tx.cityLedgerEntry.findFirst({ where: { reference: `CORP_WALLET:${bpt.id}`, accountId: ledger.id, type: 'PAYMENT' }, select: { id: true } });
  if (existingEntry) throw new CorporateSettlementError('ALREADY_SETTLED', 'Corporate wallet payment is already settled');
  const masterFolio = await input.tx.folio.findFirst({ where: { propertyId: bpt.propertyId, type: 'CITY_LEDGER', corporateAccountId: null, reservationId: null, status: 'OPEN' } }) || await input.tx.folio.create({ data: { propertyId: bpt.propertyId, type: 'CITY_LEDGER', status: 'OPEN', currency: input.verifiedCurrency, folioNumber: `AR-${bpt.propertyId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}` } });
  const payment = await input.tx.payment.create({ data: { folioId: masterFolio.id, propertyId: bpt.propertyId, method: 'PAYMENT_GATEWAY', collectionSource: 'RECEIVABLES', provider: bpt.provider, providerRef: input.providerRef, providerTransactionId: input.providerTransactionId, amount: input.verifiedAmount, currency: input.verifiedCurrency, baseAmount: input.verifiedAmount, status: 'COMPLETED', businessDate: input.businessDate, idempotencyKey: `CORP_WALLET:${bpt.id}`, receivedBy: input.systemActorId, notes: `Corporate wallet credit via ${bpt.provider}` } });
  const entry = await input.tx.cityLedgerEntry.create({ data: { accountId: ledger.id, propertyId: bpt.propertyId, folioId: masterFolio.id, amount: input.verifiedAmount, currency: input.verifiedCurrency, type: 'PAYMENT', status: 'OPEN', reference: `CORP_WALLET:${bpt.id}`, reason: 'Corporate wallet credit received through API', createdBy: input.systemActorId } });
  const allocation = await allocateCorporateGatewayReceipt({ tx: input.tx, accountId: ledger.id, propertyId: bpt.propertyId, paymentEntryId: entry.id, amount: input.verifiedAmount, currency: input.verifiedCurrency, staffId: input.systemActorId });
  if (allocation.remainingAmount <= 0.01) await input.tx.cityLedgerEntry.update({ where: { id: entry.id }, data: { status: 'SETTLED', reason: 'Corporate wallet credit fully allocated to invoices' } });
  if (allocation.appliedAmount > 0.01) await input.tx.cityLedgerAccount.update({ where: { id: ledger.id }, data: { balance: { decrement: allocation.appliedAmount } } });
  const asset = await GLMappingService.getAssetAccountForMethod(bpt.propertyId, 'PAYMENT_GATEWAY');
  const advances = await GLMappingService.getCorporateAdvancesAccount(bpt.propertyId);
  const cityLedger = await GLMappingService.getCityLedgerAccount(bpt.propertyId);
  await GeneralLedgerService.postJournal({ userId: input.systemActorId, propertyIds: [bpt.propertyId], organizationId: bpt.organizationId, role: 'SYSTEM', permissions: [], outletIds: [] }, { propertyId: bpt.propertyId, entryDate: input.businessDate, reference: `CORP_WALLET:${bpt.id}`, description: 'Corporate wallet credit received', sourceModule: 'AR', lines: [{ accountId: asset, debit: input.verifiedAmount, credit: 0, description: 'Corporate gateway wallet credit', sourceType: 'CORPORATE_WALLET_CREDIT', sourceId: entry.id }, ...(allocation.appliedAmount > 0.01 ? [{ accountId: cityLedger, debit: 0, credit: allocation.appliedAmount, description: 'Reduce outstanding corporate receivable', sourceType: 'CORPORATE_INVOICE_PAYMENT', sourceId: entry.id }] : []), ...(allocation.remainingAmount > 0.01 ? [{ accountId: advances, debit: 0, credit: allocation.remainingAmount, description: 'Unapplied corporate advance wallet credit', sourceType: 'CORPORATE_ADVANCE', sourceId: entry.id }] : [])] }, input.tx);
  await input.tx.folio.update({ where: { id: masterFolio.id }, data: { totalPayments: { increment: input.verifiedAmount }, balance: { decrement: input.verifiedAmount } } });
  await input.tx.bookingPaymentTransaction.update({ where: { id: bpt.id }, data: { cityLedgerEntryId: entry.id, paymentId: payment.id, status: 'SUCCESS', providerTxId: input.providerTransactionId, webhookVerified: true } });
  await input.tx.auditLog.create({ data: { organizationId: bpt.organizationId, propertyId: bpt.propertyId, userId: input.systemActorId, userRole: 'SYSTEM', action: 'CORPORATE_WALLET_CREDIT_SETTLED', resource: 'CityLedgerEntry', resourceId: entry.id, newValue: { amount: input.verifiedAmount, appliedAmount: allocation.appliedAmount, remainingAdvance: allocation.remainingAmount, paymentId: payment.id }, requestId: input.requestId } });
  return { paymentId: payment.id, cityLedgerEntryId: entry.id, appliedAmount: allocation.appliedAmount, remainingAdvance: allocation.remainingAmount, amount: input.verifiedAmount, currency: input.verifiedCurrency };
}

export async function settleCorporateInvoicePayment(input: {
  tx: TxClient;
  bookingPaymentTransactionId: string;
  providerRef: string;
  providerTransactionId: string;
  verifiedAmount: number;
  verifiedCurrency: string;
  businessDate: Date;
  systemActorId: string;
  requestId: string;
}) {
  const bpt = await input.tx.bookingPaymentTransaction.findUnique({ where: { id: input.bookingPaymentTransactionId }, include: { cityLedgerInvoice: true } });
  if (!bpt || !bpt.cityLedgerInvoiceId || !bpt.cityLedgerInvoice) throw new CorporateSettlementError('TRANSACTION_NOT_FOUND', 'Corporate invoice payment transaction not found');
  if (bpt.providerRef !== input.providerRef || Math.abs(Number(bpt.amount) - input.verifiedAmount) > 0.01 || String(bpt.currency).toUpperCase() !== input.verifiedCurrency.toUpperCase()) throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Verified invoice payment does not match the transaction');
  if (bpt.cityLedgerEntryId) return { paymentId: bpt.paymentId, cityLedgerEntryId: bpt.cityLedgerEntryId, invoiceId: bpt.cityLedgerInvoiceId, amount: input.verifiedAmount, currency: input.verifiedCurrency };
  const invoice = bpt.cityLedgerInvoice;
  await input.tx.$queryRaw<any[]>`SELECT id FROM "CityLedgerInvoice" WHERE id = ${invoice.id}::uuid FOR UPDATE`;
  const current = await input.tx.cityLedgerInvoice.findUnique({ where: { id: invoice.id } });
  if (!current || current.status === 'VOID' || Number(current.outstandingAmount) + 0.01 < input.verifiedAmount) throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Corporate invoice is no longer payable');
  const account = await input.tx.cityLedgerAccount.findUnique({ where: { id: current.accountId }, include: { CorporateAccount: true } });
  if (!account || account.type !== 'CORPORATE' || !account.CorporateAccount.some((item: any) => item.organizationId === bpt.organizationId && item.propertyId === bpt.propertyId && item.isActive)) throw new CorporateSettlementError('CORPORATE_ACCOUNT_MISMATCH', 'Corporate invoice account is not active');
  const masterFolio = await input.tx.folio.findFirst({ where: { propertyId: bpt.propertyId, type: 'CITY_LEDGER', corporateAccountId: null, reservationId: null, status: 'OPEN' } }) || await input.tx.folio.create({ data: { propertyId: bpt.propertyId, type: 'CITY_LEDGER', status: 'OPEN', currency: input.verifiedCurrency, folioNumber: `AR-${bpt.propertyId.slice(0, 8).toUpperCase()}-${Date.now().toString().slice(-6)}` } });
  const settlementIdentity = `CORP_INVOICE_SETTLEMENT:${bpt.id}`;
  const payment = await input.tx.payment.create({ data: { folioId: masterFolio.id, propertyId: bpt.propertyId, method: 'PAYMENT_GATEWAY', collectionSource: 'RECEIVABLES', provider: bpt.provider, providerRef: input.providerRef, providerTransactionId: input.providerTransactionId, amount: input.verifiedAmount, currency: input.verifiedCurrency, baseAmount: input.verifiedAmount, status: 'COMPLETED', businessDate: input.businessDate, idempotencyKey: settlementIdentity, receivedBy: input.systemActorId, notes: `Corporate invoice payment via ${bpt.provider}` } });
  const entry = await input.tx.cityLedgerEntry.create({ data: { accountId: current.accountId, propertyId: bpt.propertyId, folioId: masterFolio.id, invoiceId: current.id, amount: input.verifiedAmount, currency: input.verifiedCurrency, type: 'PAYMENT', status: 'SETTLED', reference: settlementIdentity, reason: `Corporate invoice ${current.invoiceNumber} paid through API`, createdBy: input.systemActorId } });
  await input.tx.cityLedgerAllocation.create({ data: { paymentId: entry.id, invoiceId: current.id, amount: input.verifiedAmount, currency: input.verifiedCurrency, createdBy: input.systemActorId } });
  const remaining = Number(current.outstandingAmount) - input.verifiedAmount;
  await input.tx.cityLedgerInvoice.update({ where: { id: current.id }, data: { paidAmount: { increment: input.verifiedAmount }, outstandingAmount: Math.max(0, remaining), status: remaining <= 0.01 ? 'PAID' : 'PARTIALLY_PAID' } });
  await input.tx.cityLedgerAccount.update({ where: { id: current.accountId }, data: { balance: { decrement: input.verifiedAmount } } });
  const asset = await GLMappingService.getAssetAccountForMethod(bpt.propertyId, 'PAYMENT_GATEWAY');
  const ledger = await GLMappingService.getCityLedgerAccount(bpt.propertyId);
  await GeneralLedgerService.postJournal({ userId: input.systemActorId, propertyIds: [bpt.propertyId], organizationId: bpt.organizationId, role: 'SYSTEM', permissions: [], outletIds: [] }, { propertyId: bpt.propertyId, entryDate: input.businessDate, reference: settlementIdentity, description: `Corporate invoice ${current.invoiceNumber} payment`, sourceModule: 'AR', lines: [{ accountId: asset, debit: input.verifiedAmount, credit: 0, description: 'Gateway receipt', sourceType: 'CORPORATE_INVOICE_PAYMENT', sourceId: entry.id }, { accountId: ledger, debit: 0, credit: input.verifiedAmount, description: 'Reduce corporate receivable', sourceType: 'CORPORATE_INVOICE_PAYMENT', sourceId: entry.id }] }, input.tx);
  await input.tx.bookingPaymentTransaction.update({ where: { id: bpt.id }, data: { cityLedgerEntryId: entry.id, paymentId: payment.id, status: 'SUCCESS', providerTxId: input.providerTransactionId, webhookVerified: true } });
  await input.tx.auditLog.create({ data: { organizationId: bpt.organizationId, propertyId: bpt.propertyId, userId: input.systemActorId, userRole: 'SYSTEM', action: 'CORPORATE_INVOICE_PAYMENT_SETTLED', resource: 'CityLedgerInvoice', resourceId: current.id, newValue: { invoiceId: current.id, paymentId: payment.id, amount: input.verifiedAmount, currency: input.verifiedCurrency }, requestId: input.requestId } });
  return { paymentId: payment.id, cityLedgerEntryId: entry.id, invoiceId: current.id, amount: input.verifiedAmount, currency: input.verifiedCurrency };
}
