import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Authentication required', 401);

    const { searchParams } = req.nextUrl;
    const propertyId = searchParams.get('propertyId');
    const businessDateStr = searchParams.get('businessDate');

    if (!propertyId || !businessDateStr) return errorResponse('BAD_REQUEST', 'Missing propertyId or businessDate', 400);
    if (!(await requireOrganizationContext(session.user.id)).propertyIds.includes(propertyId)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const businessDate = new Date(businessDateStr);

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    const items = await prisma.folioItem.findMany({
      where: { folio: { propertyId }, businessDate },
      select: { type: true, source: true, description: true, amount: true }
    });

    const startOfDay = new Date(businessDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(businessDate);
    endOfDay.setHours(23, 59, 59, 999);

    const payments = await prisma.payment.findMany({
      where: { propertyId, createdAt: { gte: startOfDay, lte: endOfDay }, status: 'COMPLETED' },
      select: { method: true, amount: true, notes: true }
    });

    const accountsMap: Record<string, any> = {};

    const addEntry = (code: string, name: string, dept: string, source: string, amount: number, isCredit: boolean) => {
      if (!accountsMap[code]) {
        accountsMap[code] = { accountCode: code, accountName: name, department: dept, debit: 0, credit: 0, netBalance: 0, transactionCount: 0, source };
      }
      if (isCredit) {
        accountsMap[code].credit += amount;
        accountsMap[code].netBalance -= amount;
      } else {
        accountsMap[code].debit += amount;
        accountsMap[code].netBalance += amount;
      }
      accountsMap[code].transactionCount++;
    };

    // Revenue -> Credit. Guest Ledger -> Debit.
    items.forEach(item => {
      const amt = Number(item.amount);
      if (item.type === 'CHARGE') {
        addEntry(`REV-${item.source}`, `${item.source} Revenue`, 'Revenue', 'Folio', amt, true); // Credit Revenue
        addEntry('LED-GUEST', 'Guest Ledger', 'Front Desk', 'Folio', amt, false); // Debit Guest Ledger
      } else if (item.type === 'DISCOUNT') {
        addEntry(`REV-${item.source}`, `${item.source} Revenue`, 'Revenue', 'Folio', Math.abs(amt), false); // Debit Revenue (reduce credit)
        addEntry('LED-GUEST', 'Guest Ledger', 'Front Desk', 'Folio', Math.abs(amt), true); // Credit Guest Ledger
      } else if (item.type === 'TAX') {
        addEntry('LIA-TAX', 'Tax Liability', 'Finance', 'Folio', amt, true); // Credit Tax Liab
        addEntry('LED-GUEST', 'Guest Ledger', 'Front Desk', 'Folio', amt, false); // Debit Guest Ledger
      }
    });

    // Payments -> Debit Bank/Cash. Credit Guest Ledger.
    payments.forEach(p => {
      const amt = Number(p.amount);
      addEntry(`AST-${p.method}`, `${p.method} Assets`, 'Finance', 'Payment', amt, false); // Debit Assets
      addEntry('LED-GUEST', 'Guest Ledger', 'Front Desk', 'Payment', amt, true); // Credit Guest Ledger
    });

    const accounts = Object.values(accountsMap);
    let totals = { debit: 0, credit: 0, difference: 0, status: 'BALANCED' };

    accounts.forEach(a => {
      totals.debit += a.debit;
      totals.credit += a.credit;
    });

    totals.difference = Math.abs(totals.debit - totals.credit);
    totals.status = totals.difference < 0.01 ? 'BALANCED' : 'OUT OF BALANCE';

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      accounts,
      totals
    });

  } catch (err: any) {
    console.error('[Trial Balance GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
