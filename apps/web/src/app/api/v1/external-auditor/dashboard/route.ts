import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { assertAuditorAccess, getExternalAuditorScope, isExternalAuditor } from '@/lib/auth/auditor-utils';

const number = (value: unknown) => Number(value || 0);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!isExternalAuditor(session)) return NextResponse.json({ error: 'External auditor access required' }, { status: 403 });
  const propertyId = request.nextUrl.searchParams.get('propertyId');
  if (!propertyId) return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });

  try {
    const scope = await getExternalAuditorScope(session.user.id, propertyId);
    const start = new Date(scope.auditPeriodStart);
    const end = new Date(scope.auditPeriodEnd);
    end.setUTCDate(end.getUTCDate() + 1);
    assertAuditorAccess(scope, propertyId, scope.auditPeriodStart);
    const date = { gte: start, lt: end };

    const [property, charges, cash, occupancy, latestClose, late, voids, discounts, discountAmount, complimentary, complimentaryAmount, journals, settlements, cashVariances, audits, revenueAccounts] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { id: true, name: true, baseCurrency: true } }),
      prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate: date, type: 'CHARGE', voidedAt: null }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { propertyId, businessDate: date, method: 'CASH', status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } }, _sum: { amount: true } }),
      prisma.nightAudit.aggregate({ where: { propertyId, businessDate: date }, _avg: { occupancy: true, adr: true } }),
      prisma.nightAuditClosePackage.findFirst({ where: { propertyId, businessDate: date }, orderBy: { businessDate: 'desc' }, select: { status: true, finalizedAt: true } }),
      prisma.folioItem.count({ where: { folio: { propertyId }, businessDate: date, isLatePosting: true } }),
      prisma.folioItem.count({ where: { folio: { propertyId }, businessDate: date, voidedAt: { not: null } } }),
      prisma.folioItem.count({ where: { folio: { propertyId }, businessDate: date, type: 'DISCOUNT' } }),
      prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate: date, type: 'DISCOUNT', voidedAt: null }, _sum: { amount: true } }),
      prisma.complimentaryRecord.count({ where: { propertyId, businessDate: date } }),
      prisma.complimentaryRecord.aggregate({ where: { propertyId, businessDate: date }, _sum: { complAmount: true } }),
      prisma.journalEntry.count({ where: { propertyId, entryDate: date, source: 'MANUAL' } }),
      prisma.posSettlement.count({ where: { propertyId, businessDate: date, status: { not: 'SETTLED' } } }),
      prisma.nightAuditFinancialSnapshot.count({ where: { nightAudit: { propertyId, businessDate: date }, cashVariance: { not: 0 } } }),
      prisma.nightAudit.findMany({ where: { propertyId, businessDate: date }, select: { businessDate: true, status: true, totalRevenue: true, occupancy: true, adr: true, revpar: true, errors: true, posUnresolvedVariances: true }, orderBy: { businessDate: 'asc' } }),
      prisma.journalEntryLine.findMany({ where: { account: { type: 'REVENUE' }, entry: { propertyId, entryDate: date, status: 'POSTED' } }, select: { debit: true, credit: true, account: { select: { code: true, name: true } } } }),
    ]);
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });

    return NextResponse.json({
      scope: { ...scope, propertyName: property.name, currency: property.baseCurrency },
      kpis: {
        totalRevenue: number(charges._sum.amount),
        cashCollected: number(cash._sum.amount),
        averageOccupancy: number(occupancy._avg.occupancy),
        adr: number(occupancy._avg.adr),
        reconciliationStatus: latestClose?.status || 'NOT_FINALIZED',
        closeFinalizedAt: latestClose?.finalizedAt || null,
      },
      trend: audits.map(item => ({ date: item.businessDate, revenue: number(item.totalRevenue), occupancy: number(item.occupancy), adr: number(item.adr), revpar: number(item.revpar), status: item.status, exceptions: item.errors + item.posUnresolvedVariances })),
      revenueMix: Object.entries(revenueAccounts.reduce<Record<string, { name: string; amount: number }>>((mix, item) => {
        const stream = item.account.code;
        const current = mix[stream] || { name: item.account.name, amount: 0 };
        current.amount += number(item.credit) - number(item.debit);
        mix[stream] = current;
        return mix;
      }, {})).map(([category, value]) => ({ category, name: value.name, amount: value.amount })).filter(item => item.amount !== 0).sort((a, b) => b.amount - a.amount),
      review: { evidenceRecords: await prisma.folioItem.count({ where: { folio: { propertyId }, businessDate: date } }), journalEntries: journals, auditEvents: await prisma.auditLog.count({ where: { propertyId, createdAt: date } }) },
      controls: { discountAmount: Math.abs(number(discountAmount._sum.amount)), complimentaryAmount: Math.abs(number(complimentaryAmount._sum.complAmount)) },
      exceptions: [
        { key: 'cash-variance', label: 'Cash Variances', count: cashVariances, risk: 'HIGH' },
        { key: 'late-posting', label: 'Backdated Transactions', count: late, risk: 'MEDIUM' },
        { key: 'voids', label: 'Voided Transactions', count: voids, risk: 'MEDIUM' },
        { key: 'discounts', label: 'Discounts', count: discounts, risk: 'MEDIUM' },
        { key: 'complimentary', label: 'Complimentary', count: complimentary, risk: 'MEDIUM' },
        { key: 'manual-journals', label: 'Manual Journal Entries', count: journals, risk: 'LOW' },
        { key: 'pos-settlements', label: 'Unreconciled POS Batches', count: settlements, risk: 'MEDIUM' },
      ],
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('403')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('External auditor dashboard failed', error);
    return NextResponse.json({ error: 'Unable to load auditor dashboard' }, { status: 500 });
  }
}
