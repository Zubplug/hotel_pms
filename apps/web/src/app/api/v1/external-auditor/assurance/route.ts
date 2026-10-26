import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getExternalAuditorScope, isExternalAuditor } from '@/lib/auth/auditor-utils';

const number = (value: unknown) => Number(value || 0);

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!isExternalAuditor(session)) return NextResponse.json({ error: 'External auditor access required' }, { status: 403 });
  const propertyId = request.nextUrl.searchParams.get('propertyId');
  if (!propertyId) return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
  try {
    const scope = await getExternalAuditorScope(session.user.id, propertyId);
    const startParam = request.nextUrl.searchParams.get('startDate');
    const endParam = request.nextUrl.searchParams.get('endDate');
    const scopeStart = new Date(scope.auditPeriodStart);
    const scopeEnd = new Date(scope.auditPeriodEnd);
    const parseDate = (value: string | null, fallback: Date) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };
    const requestedStart = parseDate(startParam, scopeStart);
    const requestedEnd = parseDate(endParam, scopeEnd);
    const start = new Date(Math.max(scopeStart.getTime(), requestedStart.getTime()));
    const endInclusive = new Date(Math.min(scopeEnd.getTime(), requestedEnd.getTime()));
    if (endInclusive < start) return NextResponse.json({ error: 'Selected period is outside the authorized engagement window.' }, { status: 400 });
    const date = { gte: start, lt: new Date(endInclusive.getTime() + 86400000) };
    const [property, folio, revenueLines, snapshots, pos, closePackages] = await Promise.all([
      prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true } }),
      prisma.folioItem.aggregate({ where: { folio: { propertyId }, businessDate: date, type: 'CHARGE', voidedAt: null }, _sum: { amount: true } }),
      prisma.journalEntryLine.findMany({ where: { account: { type: 'REVENUE' }, entry: { propertyId, entryDate: date, status: 'POSTED' } }, select: { debit: true, credit: true } }),
      prisma.nightAuditFinancialSnapshot.findMany({ where: { nightAudit: { propertyId, businessDate: date } }, select: { cashExpected: true, cashDeclared: true, cashVariance: true, grossRevenue: true, netRevenue: true, reconciliationStatus: true, finalizedAt: true } }),
      prisma.posSettlement.aggregate({ where: { propertyId, businessDate: date }, _count: { id: true }, _sum: { variance: true } }),
      prisma.nightAuditClosePackage.findMany({ where: { propertyId, businessDate: date }, select: { status: true, finalizedAt: true, packageHash: true }, orderBy: { businessDate: 'desc' } }),
    ]);
    const postedRevenue = revenueLines.reduce((sum, line) => sum + number(line.credit) - number(line.debit), 0);
    const cashExpected = snapshots.reduce((sum, item) => sum + number(item.cashExpected), 0); const cashDeclared = snapshots.reduce((sum, item) => sum + number(item.cashDeclared), 0); const cashVariance = snapshots.reduce((sum, item) => sum + number(item.cashVariance), 0);
    return NextResponse.json({ scope: { ...scope, propertyName: property?.name, currency: property?.baseCurrency }, reconciliation: { folioCharges: number(folio._sum.amount), postedRevenue, revenueDifference: number(folio._sum.amount) - postedRevenue, cashExpected, cashDeclared, cashVariance, posSettlementCount: pos._count.id, posVariance: number(pos._sum.variance), closePackages: closePackages.length, finalizedClosePackages: closePackages.filter(item => item.status === 'COMPLETED' || item.status === 'FINALIZED').length, latestClose: closePackages[0] || null }, snapshots }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('403')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('External auditor assurance failed', error); return NextResponse.json({ error: 'Unable to load assurance data' }, { status: 500 });
  }
}
