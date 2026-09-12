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

    const businessDate = new Date(`${businessDateStr}T00:00:00.000Z`);
    if (Number.isNaN(businessDate.getTime())) {
      return errorResponse('BAD_REQUEST', 'businessDate must be a valid date', 400);
    }

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    // The trial balance is an accounting report, so it must come from posted
    // journal lines and the property's real Chart of Accounts. Folios and
    // payments are operational source data, not a substitute for the GL.
    const [chartOfAccounts, postedEntries] = await Promise.all([
      prisma.chartOfAccount.findMany({
        // Include inactive accounts when they have historical posted lines;
        // otherwise an account deactivation could hide valid ledger history.
        where: { propertyId },
        orderBy: { code: 'asc' },
        select: { id: true, code: true, name: true, category: true, normalBalance: true }
      }),
      prisma.journalEntry.findMany({
        where: {
          propertyId,
          entryDate: { lte: businessDate },
          status: 'POSTED'
        },
        select: {
          id: true,
          lines: {
            select: {
              accountId: true,
              debit: true,
              credit: true
            }
          }
        }
      })
    ]);

    const balances = new Map<string, { debit: number; credit: number; transactionCount: number }>();
    for (const entry of postedEntries) {
      for (const line of entry.lines) {
        const current = balances.get(line.accountId) || { debit: 0, credit: 0, transactionCount: 0 };
        current.debit += Number(line.debit);
        current.credit += Number(line.credit);
        current.transactionCount += 1;
        balances.set(line.accountId, current);
      }
    }

    const accounts = chartOfAccounts.map(account => {
      const balance = balances.get(account.id) || { debit: 0, credit: 0, transactionCount: 0 };
      const netBalance = account.normalBalance === 'DEBIT'
        ? balance.debit - balance.credit
        : balance.credit - balance.debit;

      return {
        accountCode: account.code,
        accountName: account.name,
        department: account.category,
        debit: balance.debit,
        credit: balance.credit,
        netBalance,
        transactionCount: balance.transactionCount,
        source: 'GENERAL_LEDGER'
      };
    });
    let totals = { debit: 0, credit: 0, difference: 0, status: 'BALANCED' };

    accounts.forEach(a => {
      totals.debit += a.debit;
      totals.credit += a.credit;
    });

    totals.difference = Math.abs(totals.debit - totals.credit);
    totals.status = totals.difference < 0.01 ? 'BALANCED' : 'OUT OF BALANCE';

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      reportSource: 'POSTED_GENERAL_LEDGER',
      postedEntryCount: postedEntries.length,
      accounts,
      totals
    });

  } catch (err: any) {
    console.error('[Trial Balance GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
