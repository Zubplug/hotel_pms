import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import prisma from '@hotel-pms/db';

type ReportKind = 'pack' | 'journals' | 'trial-balance' | 'tax' | 'payroll' | 'periods' | 'audit' | 'receivables';
type RangeKind = 'week' | 'month' | 'quarter' | 'half-year' | 'year';

const csvCell = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const csv = (headers: string[], rows: unknown[][]) => [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\n');
const iso = (value: Date | null | undefined) => value ? value.toISOString().slice(0, 10) : '';
const amount = (value: unknown) => Number(value || 0).toFixed(2);

function rangeBounds(businessDate: Date, range: RangeKind) {
  const end = new Date(Date.UTC(businessDate.getUTCFullYear(), businessDate.getUTCMonth(), businessDate.getUTCDate(), 23, 59, 59, 999));
  let start: Date;
  if (range === 'week') start = new Date(end.getTime() - 6 * 86400000);
  else if (range === 'month') start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), 1));
  else if (range === 'quarter') start = new Date(Date.UTC(end.getUTCFullYear(), Math.floor(end.getUTCMonth() / 3) * 3, 1));
  else if (range === 'half-year') start = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() < 6 ? 0 : 6, 1));
  else start = new Date(Date.UTC(end.getUTCFullYear(), 0, 1));
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const params = request.nextUrl.searchParams;
    const propertyId = params.get('propertyId');
    const kind = (params.get('report') || 'pack') as ReportKind;
    const range = (params.get('range') || 'month') as RangeKind;
    if (!propertyId) return NextResponse.json({ error: 'Missing propertyId' }, { status: 400 });
    if (!['pack', 'journals', 'trial-balance', 'tax', 'payroll', 'periods', 'audit', 'receivables'].includes(kind)) return NextResponse.json({ error: 'Unsupported report' }, { status: 400 });
    if (!['week', 'month', 'quarter', 'half-year', 'year'].includes(range)) return NextResponse.json({ error: 'Unsupported range' }, { status: 400 });

    const context = await requireOrganizationContext(session.user.id);
    if (!context.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const property = await prisma.property.findUnique({ where: { id: propertyId }, select: { name: true, baseCurrency: true, businessDate: true } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    const { start, end } = rangeBounds(property.businessDate || new Date(), range);
    const [journals, taxes, payroll, periods, audit, receivables] = await Promise.all([
      prisma.journalEntry.findMany({ where: { propertyId, entryDate: { gte: start, lte: end } }, include: { lines: { include: { account: { select: { code: true, name: true, type: true, normalBalance: true } } } } }, orderBy: [{ entryDate: 'asc' }, { entryNumber: 'asc' }] }),
      prisma.taxRemittance.findMany({ where: { propertyId, periodStart: { lte: end }, periodEnd: { gte: start } }, orderBy: { periodStart: 'asc' } }),
      prisma.payrollPeriod.findMany({ where: { propertyId, startDate: { lte: end }, endDate: { gte: start } }, orderBy: { startDate: 'asc' } }),
      prisma.accountingPeriod.findMany({ where: { propertyId, periodStart: { lte: end }, periodEnd: { gte: start } }, orderBy: { periodStart: 'asc' } }),
      prisma.auditLog.findMany({ where: { propertyId, createdAt: { gte: start, lte: end } }, orderBy: { createdAt: 'asc' }, take: 5000 }),
      prisma.folio.findMany({ where: { propertyId, balance: { gt: 0 }, createdAt: { lte: end } }, include: { guest: { select: { firstName: true, lastName: true } } }, orderBy: { balance: 'desc' }, take: 5000 }),
    ]);

    const journalRows = journals.flatMap(entry => entry.lines.map(line => [entry.entryNumber, iso(entry.entryDate), entry.status, entry.source, entry.description, line.account.code, line.account.name, line.account.type, amount(line.debit), amount(line.credit)]));
    const accountMap = new Map<string, { code: string; name: string; type: string; debit: number; credit: number; lines: number }>();
    for (const entry of journals.filter(item => item.status === 'POSTED')) for (const line of entry.lines) {
      const existing = accountMap.get(line.accountId) || { code: line.account.code, name: line.account.name, type: line.account.type, debit: 0, credit: 0, lines: 0 };
      existing.debit += Number(line.debit); existing.credit += Number(line.credit); existing.lines += 1; accountMap.set(line.accountId, existing);
    }
    const trialRows = [...accountMap.values()].map(account => [account.code, account.name, account.type, amount(account.debit), amount(account.credit), amount(account.debit - account.credit), account.lines]);
    const taxRows = taxes.map(item => [item.remittanceRef || item.id, item.taxType, iso(item.periodStart), iso(item.periodEnd), amount(item.collectedAmount), amount(item.remittedAmount), item.status, item.authorityName || '']);
    const payrollRows = payroll.map(item => [item.name, iso(item.startDate), iso(item.endDate), iso(item.paymentDate), item.status, amount(item.totalGross), amount(item.totalDeductions), amount(item.totalNet), item.journalEntryId || '']);
    const periodRows = periods.map(item => [item.name, iso(item.periodStart), iso(item.periodEnd), item.status, item.notes || '']);
    const auditRows = audit.map(item => [iso(item.createdAt), item.action, item.resource, item.resourceId, item.userEmail || item.userRole || 'System', item.requestId]);
    const receivableRows = receivables.map(item => [item.folioNumber, item.guest ? `${item.guest.firstName} ${item.guest.lastName}` : 'Master folio', item.currency, amount(item.balance), amount(item.totalCharges), amount(item.totalPayments), iso(item.createdAt)]);
    const sections: Record<ReportKind, [string[], unknown[][]]> = {
      journals: [['Entry number', 'Entry date', 'Status', 'Source', 'Description', 'Account code', 'Account name', 'Account type', 'Debit', 'Credit'], journalRows],
      'trial-balance': [['Account code', 'Account name', 'Account type', 'Debit', 'Credit', 'Net debit position', 'Posting lines'], trialRows],
      tax: [['Reference', 'Tax type', 'Period start', 'Period end', 'Collected', 'Remitted', 'Status', 'Authority'], taxRows],
      payroll: [['Period', 'Start', 'End', 'Payment date', 'Status', 'Gross', 'Deductions', 'Net', 'Journal entry'], payrollRows],
      periods: [['Period', 'Start', 'End', 'Status', 'Notes'], periodRows],
      audit: [['Created at', 'Action', 'Resource', 'Resource ID', 'Actor', 'Request ID'], auditRows],
      receivables: [['Folio', 'Guest', 'Currency', 'Balance', 'Charges', 'Payments', 'Created'], receivableRows],
      pack: [[], []],
    };
    const packSections: Array<[string, [string[], unknown[][]]]> = [
      ['JOURNAL REGISTER', sections.journals], ['TRIAL BALANCE', sections['trial-balance']], ['TAX REMITTANCES', sections.tax], ['PAYROLL PERIODS', sections.payroll], ['ACCOUNTING PERIODS', sections.periods], ['OPEN RECEIVABLES', sections.receivables], ['AUDIT ACTIVITY', sections.audit],
    ];
    const body = kind === 'pack'
      ? [`Property,${csvCell(property.name)}`, `Currency,${csvCell(property.baseCurrency || 'NGN')}`, `Range,${csvCell(range)}`, `From,${iso(start)}`, `To,${iso(end)}`, '', ...packSections.flatMap(([title, [headers, rows]]) => [`${title}`, csv(headers, rows), ''])].join('\n')
      : csv(sections[kind][0], sections[kind][1]);
    const filename = `accounting-${kind}-${range}-${iso(start)}-to-${iso(end)}.csv`;
    return new NextResponse(`\ufeff${body}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Accounting report export failed', error);
    return NextResponse.json({ error: 'Unable to generate accounting report' }, { status: 500 });
  }
}
