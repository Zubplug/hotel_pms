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

    // We'll map Frontdesk Sessions
    const sessions = await prisma.frontdeskSession.findMany({
      where: { propertyId, businessDate },
      include: { staff: true }
    });

    // POS sessions are separate cashier shifts and must be reported alongside
    // Front Desk sessions for the same business date.
    const posSessions = await prisma.posSession.findMany({
      where: { propertyId, businessDate },
      include: { primaryOperator: true, outlet: true, payments: true },
      orderBy: { openedAt: 'asc' },
    });

    const cashiers = await Promise.all(sessions.map(async (session) => {
      const openingFloat = Number(session.openingFloat || 0);
      const expectedCash = Number(session.systemExpectedCash || 0);
      const actualCash = Number(session.declaredCash || 0);
      const variance = Number(session.variance || (actualCash - expectedCash));

      // Aggregate payments linked to this session
      const paymentsAggr = await prisma.payment.groupBy({
        by: ['method'],
        where: { 
          propertyId, 
          status: 'COMPLETED',
          OR: [
            { frontdeskSessionId: session.id },
            { 
              receivedBy: session.staffId, 
              createdAt: { 
                gte: session.openedAt, 
                lte: session.closedAt || new Date(businessDate.getTime() + 24*60*60*1000) 
              } 
            }
          ]
        },
        _sum: { amount: true }
      });

      let cashSales = 0, cardSales = 0, bankTransfer = 0, posPayment = 0, other = 0;
      paymentsAggr.forEach(p => {
        const amt = Number(p._sum.amount || 0);
        if (p.method === 'CASH') cashSales += amt;
        else if (p.method === 'CARD') cardSales += amt;
        else if (p.method === 'BANK_TRANSFER') bankTransfer += amt;
        else if (p.method === 'POS') posPayment += amt;
        else other += amt;
      });

      // Refunds
      const refundsAggr = await prisma.payment.aggregate({
        where: { 
          propertyId, 
          status: 'REFUNDED',
          OR: [
            { frontdeskSessionId: session.id },
            { 
              receivedBy: session.staffId, 
              createdAt: { 
                gte: session.openedAt, 
                lte: session.closedAt || new Date(businessDate.getTime() + 24*60*60*1000) 
              } 
            }
          ]
        },
        _sum: { amount: true }
      });
      const cashRefunds = Math.abs(Number(refundsAggr._sum.amount || 0));

      return {
        cashierName: `${session.staff?.firstName || 'Unknown'} ${session.staff?.lastName || ''}`.trim(),
        shiftReference: session.shiftReference || session.id.slice(-6).toUpperCase(),
        status: session.status,
        openingFloat,
        cashSales,
        cardSales,
        bankTransfer,
        posPayment,
        other,
        cashRefunds,
        paidOuts: 0,
        cashDrops: actualCash,
        expectedCash,
        actualCash,
        variance,
        supervisorApproval: variance === 0 ? 'APPROVED' : 'PENDING'
      };
    }));

    const posCashiers = posSessions.map((session) => {
      const totals = { cashSales: 0, cardSales: 0, bankTransfer: 0, posPayment: 0, other: 0 };
      for (const payment of session.payments) {
        if (!['CONFIRMED', 'PAID'].includes(payment.status)) continue;
        const amount = Number(payment.amount || 0);
        if (payment.method === 'CASH') totals.cashSales += amount;
        else if (payment.method === 'CARD' || payment.method === 'CARD_OFFLINE') totals.cardSales += amount;
        else if (payment.method === 'BANK_TRANSFER') totals.bankTransfer += amount;
        else if (payment.method === 'POS') totals.posPayment += amount;
        else totals.other += amount;
      }
      const openingFloat = Number(session.openingCash || 0);
      const cashRefunds = Number(session.cashRefunds || 0);
      const paidOuts = Number(session.cashOut || 0);
      const cashIn = Number(session.cashIn || 0);
      const cashDrops = 0;
      const expectedCash = openingFloat + totals.cashSales + cashIn - cashRefunds - paidOuts;
      const actualCash = session.actualCash == null ? 0 : Number(session.actualCash);
      const variance = session.actualCash == null ? 0 : actualCash - expectedCash;

      return {
        cashierName: `${session.primaryOperator?.firstName || 'POS'} ${session.primaryOperator?.lastName || ''}`.trim(),
        shiftReference: `POS-${session.id.slice(-8).toUpperCase()}`,
        status: session.status,
        openingFloat,
        ...totals,
        cashRefunds,
        paidOuts,
        cashDrops,
        expectedCash,
        actualCash,
        variance,
        supervisorApproval: variance === 0 ? 'APPROVED' : 'PENDING',
        outletName: session.outlet?.name || 'POS',
      };
    });

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      cashiers: [...cashiers, ...posCashiers]
    });

  } catch (err: any) {
    console.error('[Cashier Summary GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
