import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma from '@hotel-pms/db';
import { errorResponse, successResponse } from '@/lib/api-response';
import { buildNightAuditBalanceProof } from '@/lib/night-audit-accounting';

const round = (value: number) => Math.round(value * 100) / 100;

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const propertyId = req.nextUrl.searchParams.get('propertyId');
    const dateValue = req.nextUrl.searchParams.get('businessDate');
    if (!propertyId || !dateValue) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);

    const context = await requireOrganizationContext(session.user.id);
    if (!context.propertyIds.includes(propertyId)) return errorResponse('FORBIDDEN', 'Property access denied', 403);

    const businessDate = new Date(`${dateValue}T00:00:00.000Z`);
    if (Number.isNaN(businessDate.getTime())) return errorResponse('BAD_REQUEST', 'Invalid businessDate', 400);

    const [property, audit, snapshot, items, posOrders, frontDeskPayments, posPayments, journalEntries] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, name: true, baseCurrency: true } }),
      prisma.nightAudit.findUnique({ where: { propertyId_businessDate: { propertyId, businessDate } }, select: { id: true, status: true, startedAt: true, completedAt: true } }),
      prisma.nightAuditFinancialSnapshot.findFirst({ where: { nightAudit: { propertyId, businessDate } } }),
      prisma.folioItem.findMany({
        where: { folio: { propertyId }, businessDate, voidedAt: null },
        select: { type: true, source: true, revenueCategory: true, amount: true, posTransactionId: true },
      }),
      prisma.posOrder.findMany({
        where: { propertyId, businessDate, status: 'CLOSED', paymentStatus: 'PAID' },
        select: { id: true, total: true, payments: { where: { status: 'CONFIRMED' }, select: { amount: true, method: true } } },
      }),
      prisma.payment.groupBy({
        by: ['method'],
        where: {
          propertyId,
          status: 'COMPLETED',
          businessDate,
        },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.posPayment.groupBy({
        by: ['method'],
        where: { businessDate, status: { in: ['CONFIRMED', 'PAID'] }, order: { propertyId } },
        _sum: { amount: true },
        _count: { id: true },
      }),
      prisma.journalEntry.aggregate({
        where: { propertyId, entryDate: businessDate, status: 'POSTED' },
        _sum: { totalDebit: true, totalCredit: true },
        _count: { id: true },
      }),
    ]);

    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    let roomRevenue = 0;
    let fnbRevenue = 0;
    let otherRevenue = 0;
    let taxes = 0;
    let discounts = 0;
    let refunds = 0;

    for (const item of items) {
      const amount = Number(item.amount || 0);
      if (item.type === 'CHARGE') {
        if (item.source === 'ROOM_CHARGE' || item.source === 'DAY_USE_ROOM_CHARGE' || item.revenueCategory === 'ROOM') roomRevenue += amount;
        else if (item.source === 'POS' || item.source === 'RESTAURANT' || item.source === 'BAR' || item.revenueCategory === 'FNB') fnbRevenue += amount;
        else if (item.revenueCategory === 'TAX') taxes += amount;
        else otherRevenue += amount;
      } else if (item.type === 'TAX') taxes += amount;
      else if (item.type === 'DISCOUNT' || item.type === 'COMPLIMENTARY') discounts += Math.abs(amount);
      else if (item.type === 'REFUND') refunds += amount;
    }

    const representedPosOrders = new Set(items.filter((item) => item.type === 'CHARGE' && item.source === 'POS' && item.posTransactionId).map((item) => item.posTransactionId as string));
    let directPosOrders = 0;
    for (const order of posOrders) {
      if (representedPosOrders.has(order.id)) continue;
      const complimentary = order.payments
        .filter((payment) => String(payment.method).toUpperCase() === 'COMPLIMENTARY')
        .reduce((sum, payment) => sum + Number(payment.amount), 0);
      directPosOrders += Math.max(0, Number(order.total) - complimentary);
    }
    fnbRevenue += directPosOrders;

    const sourceTotals = {
      roomRevenue: round(roomRevenue),
      fnbRevenue: round(fnbRevenue),
      otherRevenue: round(otherRevenue),
      taxes: round(taxes),
      discounts: round(discounts),
      refunds: round(refunds),
      grossRevenue: round(roomRevenue + fnbRevenue + otherRevenue),
      netRevenue: round(roomRevenue + fnbRevenue + otherRevenue - discounts - refunds),
    };

    const snapshotTotals = snapshot ? {
      roomRevenue: Number(snapshot.roomRevenue), fnbRevenue: Number(snapshot.fnbRevenue), otherRevenue: Number(snapshot.otherRevenue),
      taxes: Number(snapshot.taxes), discounts: Number(snapshot.discounts), refunds: Number(snapshot.refunds),
      grossRevenue: Number(snapshot.grossRevenue), netRevenue: Number(snapshot.netRevenue),
    } : null;
    const grossVariance = snapshotTotals ? round(sourceTotals.grossRevenue - snapshotTotals.grossRevenue) : null;
    const payments = new Map<string, { amount: number; count: number }>();
    for (const payment of [...frontDeskPayments, ...posPayments]) {
      const current = payments.get(payment.method) || { amount: 0, count: 0 };
      current.amount += Number(payment._sum.amount || 0);
      current.count += payment._count.id;
      payments.set(payment.method, current);
    }

    const debit = Number(journalEntries._sum.totalDebit || 0);
    const credit = Number(journalEntries._sum.totalCredit || 0);
    const ledgerDifference = round(debit - credit);

    const balanceProof = await buildNightAuditBalanceProof(prisma, { propertyId, businessDate });

    return successResponse({
      property,
      businessDate: dateValue,
      audit: { ...audit, hasSnapshot: Boolean(snapshot) },
      snapshot: snapshotTotals,
      sourceTotals,
      variance: { grossRevenue: grossVariance, status: grossVariance === null ? 'NOT_RUN' : Math.abs(grossVariance) < 0.01 ? 'BALANCED' : 'REVIEW' },
      payments: [...payments.entries()].map(([method, value]) => ({ method, amount: round(value.amount), count: value.count })).sort((a, b) => b.amount - a.amount),
      ledger: { debit: round(debit), credit: round(credit), difference: ledgerDifference, entryCount: journalEntries._count.id, status: Math.abs(ledgerDifference) < 0.01 ? 'BALANCED' : 'REVIEW' },
      balanceProof,
      coverage: { folioItems: items.length, paidPosOrders: posOrders.length, directPosOrders: posOrders.filter((order) => !representedPosOrders.has(order.id)).length },
    });
  } catch (error: any) {
    console.error('[Night Audit Reconciliation GET]', error);
    return errorResponse('INTERNAL_ERROR', error.message || 'Unable to load reconciliation', 500);
  }
}
