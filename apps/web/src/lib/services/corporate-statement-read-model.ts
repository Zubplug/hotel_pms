import prisma from '@hotel-pms/db';
import { sumDecimal, sumSignedDecimal } from '@/lib/finance/billing-contracts';
import type { BillingScope } from '@/lib/services/billing-read-model';

export type CorporateStatement = {
  account: { id: string; name: string; code?: string | null; type: string; currency: string };
  property: BillingScope['property'];
  asOf: string;
  invoices: Array<{
    id: string;
    invoiceNumber: string;
    description: string;
    issueDate: string;
    dueDate: string;
    status: string;
    currency: string;
    originalAmount: string;
    sourcePaidAmount: string;
    allocatedAmount: string;
    outstandingAmount: string;
    allocationVariance: string;
    context: {
      guestName?: string;
      roomNumbers: string[];
      confirmationNumber?: string;
      checkIn?: string | null;
      checkOut?: string | null;
    };
  }>;
  payments: Array<{
    id: string;
    date: string;
    amount: string;
    currency: string;
    reference: string | null;
    status: string;
    allocatedAmount: string;
    unappliedAmount: string;
  }>;
  totals: {
    originalAmount: string;
    paidAmount: string;
    outstandingAmount: string;
    unappliedAmount: string;
    currency: string;
  };
};

const decimal = (value: unknown) => String(value ?? '0');

export async function getCorporateStatement(scope: BillingScope, accountId: string): Promise<CorporateStatement | null> {
  const account = await (prisma as any).cityLedgerAccount.findFirst({
    where: { id: accountId, propertyId: scope.propertyId, organizationId: scope.ctx.organizationId },
    include: {
      invoices: {
        where: { status: { not: 'VOID' }, issueDate: { lte: scope.asOf } },
        orderBy: [{ issueDate: 'asc' }, { invoiceNumber: 'asc' }],
        include: { allocations: { include: { payment: true } } },
      },
      entries: {
        where: { type: 'PAYMENT', status: { not: 'REVERSED' }, createdAt: { lte: scope.asOf } },
        orderBy: { createdAt: 'asc' },
        include: { allocations: { select: { amount: true } } },
      },
    },
  });
  if (!account) return null;

  const invoiceIds = account.invoices.map((invoice: any) => invoice.id);
  const invoiceEntries = invoiceIds.length ? await (prisma as any).cityLedgerEntry.findMany({
    where: { invoiceId: { in: invoiceIds }, propertyId: scope.propertyId },
    orderBy: { createdAt: 'asc' },
    include: {
      guest: true,
      reservation: {
        include: {
          primaryGuest: true,
          reservationRooms: { include: { room: { select: { number: true } } }, orderBy: { checkIn: 'asc' } },
        },
      },
      folio: {
        include: {
          guest: true,
          reservation: {
            include: {
              primaryGuest: true,
              reservationRooms: { include: { room: { select: { number: true } } }, orderBy: { checkIn: 'asc' } },
            },
          },
        },
      },
    },
  }) : [];
  const displayRoomNumber = (value: unknown) => {
    const text = String(value || '').trim();
    return text ? text.split('.').pop() || text : '';
  };
  const contextByInvoice = new Map<string, {
    guestName?: string;
    roomNumbers: string[];
    confirmationNumber?: string;
    checkIn?: string | null;
    checkOut?: string | null;
  }>();
  for (const entry of invoiceEntries) {
    const reservation = entry.reservation || entry.folio?.reservation;
    const guest = entry.guest || entry.folio?.guest || reservation?.primaryGuest;
    const guestName = guest ? `${guest.firstName || ''} ${guest.lastName || ''}`.trim() : undefined;
    const context = {
      guestName: guestName || undefined,
      roomNumbers: (reservation?.reservationRooms || []).map((room: any) => displayRoomNumber(room.room?.number)).filter(Boolean),
      confirmationNumber: reservation?.confirmationNumber || undefined,
      checkIn: reservation?.checkIn ? new Date(reservation.checkIn).toISOString() : null,
      checkOut: reservation?.checkOut ? new Date(reservation.checkOut).toISOString() : null,
    };
    const existing = contextByInvoice.get(entry.invoiceId);
    if (!existing || (!existing.guestName && context.guestName) || existing.roomNumbers.length === 0 && context.roomNumbers.length > 0) {
      contextByInvoice.set(entry.invoiceId, context);
    }
  }

  const invoices = account.invoices.map((invoice: any) => {
    const allocatedAmount = sumDecimal((invoice.allocations || []).map((allocation: any) => decimal(allocation.amount)));
    const sourcePaidAmount = decimal(invoice.paidAmount);
    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      description: invoice.description,
      issueDate: new Date(invoice.issueDate).toISOString(),
      dueDate: new Date(invoice.dueDate).toISOString(),
      status: invoice.status,
      currency: invoice.currency,
      originalAmount: decimal(invoice.amount),
      sourcePaidAmount,
      allocatedAmount,
      outstandingAmount: decimal(invoice.outstandingAmount),
      allocationVariance: sumSignedDecimal([allocatedAmount, `-${sourcePaidAmount}`]),
      context: contextByInvoice.get(invoice.id) || { roomNumbers: [] },
    };
  });

  const payments = account.entries.map((entry: any) => {
    const amount = decimal(entry.amount);
    const allocatedAmount = sumDecimal((entry.allocations || []).map((allocation: any) => decimal(allocation.amount)));
    return {
      id: entry.id,
      date: new Date(entry.createdAt).toISOString(),
      amount,
      currency: entry.currency,
      reference: entry.reference || null,
      status: entry.status,
      allocatedAmount,
      unappliedAmount: sumSignedDecimal([amount, `-${allocatedAmount}`]),
    };
  });

  const currency = account.currency || scope.currency || 'NGN';
  return {
    account: { id: account.id, name: account.name, code: account.code || null, type: account.type, currency },
    property: scope.property,
    asOf: scope.asOf.toISOString(),
    invoices,
    payments,
    totals: {
      originalAmount: sumDecimal(invoices.map((invoice: any) => invoice.originalAmount)),
      paidAmount: sumDecimal(invoices.map((invoice: any) => invoice.sourcePaidAmount)),
      outstandingAmount: sumDecimal(invoices.map((invoice: any) => invoice.outstandingAmount)),
      unappliedAmount: sumSignedDecimal(payments.map((payment: any) => payment.unappliedAmount)),
      currency,
    },
  };
}
