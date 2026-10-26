import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { getExternalAuditorScope, isExternalAuditor } from '@/lib/auth/auditor-utils';

const csvCell = (value: unknown) => {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  if (!isExternalAuditor(session)) return NextResponse.json({ error: 'External auditor access required' }, { status: 403 });
  const propertyId = request.nextUrl.searchParams.get('propertyId');
  const kind = request.nextUrl.searchParams.get('kind') || 'general-ledger';
  const format = request.nextUrl.searchParams.get('format') || 'json';
  if (!propertyId) return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
  if (!['management', 'general-ledger', 'trial-balance', 'revenue', 'night-audit'].includes(kind)) return NextResponse.json({ error: 'Unsupported report' }, { status: 400 });

  try {
    const scope = await getExternalAuditorScope(session.user.id, propertyId);
    const parseDate = (value: string | null, fallback: Date) => {
      if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
      const parsed = new Date(`${value}T00:00:00.000Z`);
      return Number.isNaN(parsed.getTime()) ? fallback : parsed;
    };
    const scopeStart = new Date(scope.auditPeriodStart);
    const scopeEnd = new Date(scope.auditPeriodEnd);
    const requestedStart = parseDate(request.nextUrl.searchParams.get('startDate'), scopeStart);
    const requestedEnd = parseDate(request.nextUrl.searchParams.get('endDate'), scopeEnd);
    const start = new Date(Math.max(scopeStart.getTime(), requestedStart.getTime()));
    const endInclusive = new Date(Math.min(scopeEnd.getTime(), requestedEnd.getTime()));
    if (endInclusive < start) return NextResponse.json({ error: 'Selected period is outside the authorized engagement window.' }, { status: 400 });
    const end = new Date(endInclusive.getTime() + 86400000);
    const reportStart = kind === 'management' ? scopeStart : start;
    const reportEnd = kind === 'management' ? new Date(scopeEnd.getTime() + 86400000) : end;
    const entries = await prisma.journalEntry.findMany({ where: { propertyId, entryDate: { gte: reportStart, lt: reportEnd } }, include: { lines: { include: { account: { select: { code: true, name: true, type: true } } } } }, orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }] });

    let rows: unknown[][];
    let headers: string[];
    if (kind === 'management') {
      headers = ['Metric', 'Today', 'Last 7 days', 'MTD', 'YTD'];
      const [occupancySnapshots, audits, payments, complimentary, posOrders] = await Promise.all([
        prisma.occupancySnapshot.findMany({ where: { propertyId, businessDate: { gte: reportStart, lt: reportEnd } }, select: { businessDate: true, totalRooms: true, availableRooms: true, occupiedRooms: true, occupancyPct: true, adr: true, revpar: true } }),
        prisma.nightAudit.findMany({ where: { propertyId, businessDate: { gte: reportStart, lt: reportEnd } }, select: { businessDate: true, totalRoomRevenue: true, totalRevenue: true } }),
        prisma.payment.findMany({ where: { propertyId, businessDate: { gte: reportStart, lt: reportEnd }, status: { in: ['COMPLETED', 'PARTIALLY_REFUNDED'] } }, select: { businessDate: true, method: true, amount: true } }),
        prisma.complimentaryRecord.findMany({ where: { propertyId, businessDate: { gte: reportStart, lt: reportEnd } }, select: { businessDate: true, complAmount: true } }),
        prisma.posOrder.findMany({ where: { propertyId, businessDate: { gte: reportStart, lt: reportEnd }, status: { notIn: ['VOIDED', 'CANCELLED'] } }, select: { businessDate: true, total: true, guestCount: true, outlet: { select: { name: true } } } }),
      ]);
      const periods = [{ label: 'Today', start: new Date() }, { label: 'Last 7 days', start: new Date() }, { label: 'MTD', start: new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)) }, { label: 'YTD', start: new Date(Date.UTC(new Date().getUTCFullYear(), 0, 1)) }];
      periods[1].start.setUTCDate(periods[1].start.getUTCDate() - 6);
      const todayKey = new Date().toISOString().slice(0, 10);
      const key = (value: Date) => value.toISOString().slice(0, 10);
      const inPeriod = (value: Date, period: { start: Date }) => { const dateKey = key(value); return dateKey >= key(period.start) && dateKey <= todayKey; };
      const sum = <T extends { businessDate: Date }>(items: T[], period: { start: Date }, value: (item: T) => number) => items.filter(item => inPeriod(item.businessDate, period)).reduce((total, item) => total + value(item), 0);
      const section = (label: string) => [label, '', '', '', ''];
      const metric = (label: string, values: number[]) => [label, ...values];
      const departmentsByPeriod = (period: { start: Date }) => {
        const totals = new Map<string, number>();
        for (const entry of entries) if (inPeriod(entry.entryDate, period)) for (const line of entry.lines) if (line.account.type === 'REVENUE') totals.set(line.account.name, (totals.get(line.account.name) || 0) + Number(line.credit) - Number(line.debit));
        return totals;
      };
      const roomRevenue = (period: { start: Date }) => sum(audits, period, item => Number(item.totalRoomRevenue));
      const availableRooms = (period: { start: Date }) => sum(occupancySnapshots, period, item => item.availableRooms);
      const occupiedRooms = (period: { start: Date }) => sum(occupancySnapshots, period, item => item.occupiedRooms);
      const revenueRows = [...new Set(periods.flatMap(period => [...departmentsByPeriod(period).keys()]))].sort().map(department => metric(department, periods.map(period => departmentsByPeriod(period).get(department) || 0)));
      const outletNames = [...new Set(posOrders.map(order => order.outlet.name))].sort();
      const outletRows = outletNames.flatMap(outlet => [
        metric(`${outlet} revenue`, periods.map(period => sum(posOrders, period, order => order.outlet.name === outlet ? Number(order.total) : 0))),
        metric(`${outlet} covers`, periods.map(period => sum(posOrders, period, order => order.outlet.name === outlet ? order.guestCount : 0))),
      ]);
      const totalFnb = periods.map(period => sum(posOrders, period, order => Number(order.total)));
      const totalCovers = periods.map(period => sum(posOrders, period, order => order.guestCount));
      rows = [
        section('ROOM STATISTICS'),
        metric('Total rooms availability', periods.map(period => availableRooms(period))),
        metric('Total occupied rooms', periods.map(period => occupiedRooms(period))),
        metric('Total vacant rooms', periods.map(period => Math.max(availableRooms(period) - occupiedRooms(period), 0))),
        metric('Total sold rooms', periods.map(period => occupiedRooms(period))),
        metric('Total complimentary rooms', periods.map(() => 0)),
        metric('Total occupancy %', periods.map(period => { const available = availableRooms(period); return available ? (occupiedRooms(period) / available) * 100 : 0; })),
        metric('Total sold rooms %', periods.map(period => { const available = availableRooms(period); return available ? (occupiedRooms(period) / available) * 100 : 0; })),
        metric('Total complimentary rooms %', periods.map(() => 0)),
        metric('Total rooms revenue', periods.map(period => roomRevenue(period))),
        metric('Average room rate', periods.map(period => { const occupied = occupiedRooms(period); return occupied ? roomRevenue(period) / occupied : 0; })),
        metric('Revenue per available room', periods.map(period => { const available = availableRooms(period); return available ? roomRevenue(period) / available : 0; })),
        section('REVENUE BY DEPARTMENT'),
        ...revenueRows,
        metric('Total hotel revenue', periods.map(period => sum(audits, period, item => Number(item.totalRevenue)) || departmentsByPeriod(period).values().reduce((total, amount) => total + amount, 0))),
        section('FOOD AND BEVERAGE REVENUE'),
        ...outletRows,
        metric('Total food & beverage revenue', totalFnb),
        metric('Total covers', totalCovers),
        section('PAYMENT SUMMARY'),
        ...['CASH', 'BANK_TRANSFER', 'POS', 'CARD', 'CARD_OFFLINE', 'PAYMENT_GATEWAY', 'MOBILE_PAYMENT'].map(method => metric(method.replaceAll('_', ' '), periods.map(period => sum(payments, period, item => String(item.method) === method ? Number(item.amount) : 0)))),
        metric('Complimentary revenue', periods.map(period => sum(complimentary, period, item => Number(item.complAmount)))),
      ];
    } else if (kind === 'general-ledger') {
      headers = ['Entry', 'Date', 'Status', 'Source', 'Description', 'Account', 'Account name', 'Debit', 'Credit'];
      rows = entries.flatMap(entry => entry.lines.map(line => [entry.entryNumber, entry.entryDate.toISOString().slice(0, 10), entry.status, entry.source, entry.description, line.account.code, line.account.name, Number(line.debit), Number(line.credit)]));
    } else if (kind === 'trial-balance') {
      headers = ['Account', 'Account name', 'Type', 'Debit', 'Credit', 'Net'];
      const map = new Map<string, { code: string; name: string; type: string; debit: number; credit: number }>();
      for (const entry of entries.filter(item => item.status === 'POSTED')) for (const line of entry.lines) {
        const row = map.get(line.accountId) || { code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0 };
        row.debit += Number(line.debit); row.credit += Number(line.credit); map.set(line.accountId, row);
      }
      rows = [...map.values()].map(row => [row.code, row.name, row.type, row.debit, row.credit, row.debit - row.credit]);
    } else if (kind === 'revenue') {
      headers = ['Business date', 'Description', 'Category', 'Amount', 'Currency', 'Source'];
      const items = await prisma.folioItem.findMany({ where: { folio: { propertyId }, businessDate: { gte: start, lt: end }, type: 'CHARGE', voidedAt: null }, select: { businessDate: true, description: true, revenueCategory: true, amount: true, currency: true, source: true }, orderBy: { businessDate: 'asc' } });
      rows = items.map(item => [item.businessDate.toISOString().slice(0, 10), item.description, item.revenueCategory, Number(item.amount), item.currency, item.source]);
    } else {
      headers = ['Business date', 'Status', 'Revenue', 'Occupancy', 'ADR', 'Exceptions'];
      const audits = await prisma.nightAudit.findMany({ where: { propertyId, businessDate: { gte: start, lt: end } }, select: { businessDate: true, status: true, totalRevenue: true, occupancy: true, adr: true, errors: true, posUnresolvedVariances: true }, orderBy: { businessDate: 'asc' } });
      rows = audits.map(item => [item.businessDate.toISOString().slice(0, 10), item.status, Number(item.totalRevenue), Number(item.occupancy), Number(item.adr), item.errors + item.posUnresolvedVariances]);
    }
    if (format === 'csv') {
      const body = [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
      return new NextResponse(`\ufeff${body}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="auditor-${kind}.csv"`, 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({ scope, kind, headers, rows }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('403')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    console.error('External auditor report failed', error);
    return NextResponse.json({ error: 'Unable to generate report' }, { status: 500 });
  }
}
