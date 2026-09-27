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
  if (!['general-ledger', 'trial-balance', 'revenue', 'night-audit'].includes(kind)) return NextResponse.json({ error: 'Unsupported report' }, { status: 400 });

  try {
    const scope = await getExternalAuditorScope(session.user.id, propertyId);
    const start = new Date(scope.auditPeriodStart);
    const end = new Date(scope.auditPeriodEnd);
    end.setUTCDate(end.getUTCDate() + 1);
    const entries = await prisma.journalEntry.findMany({ where: { propertyId, entryDate: { gte: start, lt: end } }, include: { lines: { include: { account: { select: { code: true, name: true, type: true } } } } }, orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }] });

    let rows: unknown[][];
    let headers: string[];
    if (kind === 'general-ledger') {
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
