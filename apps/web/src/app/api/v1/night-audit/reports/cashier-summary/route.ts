/* eslint-disable @typescript-eslint/no-explicit-any */
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

    if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDateStr)) return errorResponse('BAD_REQUEST', 'businessDate must be YYYY-MM-DD', 400);
    const businessDate = new Date(`${businessDateStr}T00:00:00.000Z`);

    const nightAudit = await prisma.nightAudit.findUnique({
      where: { propertyId_businessDate: { propertyId, businessDate } }
    });

    const property = await prisma.property.findUnique({ where: { id: propertyId } });

    // We'll map Frontdesk Sessions
    const sessions = await prisma.frontdeskSession.findMany({
      where: { propertyId, businessDate },
      include: { staff: true, exceptions: { select: { id: true, severity: true, status: true, reason: true, amount: true } } }
    });

    // POS sessions are separate cashier shifts and must be reported alongside
    // Front Desk sessions for the same business date.
    const posSessions = await prisma.posSession.findMany({
      where: { propertyId, businessDate },
      include: { primaryOperator: true, outlet: true, payments: true, cashMovements: true },
      orderBy: { openedAt: 'asc' },
    });

    const cashiers = await Promise.all(sessions.map(async (session) => {
      const openingFloat = Number(session.openingFloat || 0);
      const expectedCash = Number(session.systemExpectedCash || 0);
      const actualCash = Number(session.declaredCash || 0);
      const variance = Number(session.variance || (actualCash - expectedCash));

      // Aggregate payments linked to this session
      const [paymentsAggr, refundsAggr, movementAggr] = await Promise.all([prisma.payment.groupBy({
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
        _sum: { amount: true }, _count: { id: true }
      }),
      prisma.payment.aggregate({
        where: { propertyId, status: 'REFUNDED', frontdeskSessionId: session.id },
        _sum: { amount: true }
      }),
      prisma.posCashMovement.groupBy({ by: ['type'], where: { frontdeskSessionId: session.id }, _sum: { amount: true } })]);

      let cashSales = 0, cardSales = 0, bankTransfer = 0, posPayment = 0, other = 0;
      paymentsAggr.forEach(p => {
        const amt = Number(p._sum.amount || 0);
        if (p.method === 'CASH') cashSales += amt;
        else if (p.method === 'CARD') cardSales += amt;
        else if (p.method === 'BANK_TRANSFER') bankTransfer += amt;
        else if (p.method === 'POS') posPayment += amt;
        else other += amt;
      });

      const cashRefunds = Math.abs(Number(refundsAggr._sum.amount || 0));
      const cashDrops = movementAggr.filter((row) => row.type === 'CASH_DROP').reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
      const paidOuts = movementAggr.filter((row) => row.type === 'PAID_OUT').reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);
      const cashIn = movementAggr.filter((row) => ['CASH_TRANSFER_IN', 'FLOAT_ADJUSTMENT'].includes(String(row.type))).reduce((sum, row) => sum + Number(row._sum.amount || 0), 0);

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
        paidOuts,
        cashDrops,
        cashIn,
        expectedCash,
        actualCash,
        variance,
        paymentCount: paymentsAggr.reduce((sum, row) => sum + (row._count?.id || 0), 0),
        exceptionCount: session.exceptions.length,
        exceptions: session.exceptions.map((exception) => ({ severity: exception.severity, status: exception.status, reason: exception.reason, amount: Number(exception.amount || 0) })),
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        supervisorApproval: session.approvalDecision || (session.status === 'APPROVED' || session.status === 'RECONCILED' ? 'APPROVED' : session.status === 'RETURNED' ? 'RETURNED' : session.declaredCash == null ? 'NOT_SUBMITTED' : 'PENDING'),
        controlStatus: session.controlStatus,
        sessionType: 'FRONT_DESK'
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
      const cashDrops = session.cashMovements.filter((movement) => movement.type === 'CASH_DROP').reduce((sum, movement) => sum + Number(movement.amount || 0), 0);
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
        supervisorApproval: session.approvalDecision || (session.approvalDecision === 'APPROVED' || session.controlStatus === 'APPROVED' ? 'APPROVED' : session.actualCash == null ? 'NOT_SUBMITTED' : 'PENDING'),
        outletName: session.outlet?.name || 'POS',
        cashIn,
        paymentCount: session.payments.filter((payment) => ['CONFIRMED', 'PAID'].includes(payment.status)).length,
        exceptionCount: 0,
        exceptions: [],
        openedAt: session.openedAt,
        closedAt: session.closedAt,
        sessionType: 'POS',
        controlStatus: session.controlStatus,
      };
    });

    const allCashiers = [...cashiers, ...posCashiers];
    const totals = allCashiers.reduce((result, cashier) => {
      for (const key of ['cashSales', 'cardSales', 'bankTransfer', 'posPayment', 'other', 'cashRefunds', 'paidOuts', 'cashDrops', 'cashIn', 'openingFloat', 'expectedCash', 'actualCash', 'variance'] as const) result[key] += Number((cashier as any)[key] || 0);
      result.paymentCount += Number(cashier.paymentCount || 0);
      return result;
    }, { cashSales: 0, cardSales: 0, bankTransfer: 0, posPayment: 0, other: 0, cashRefunds: 0, paidOuts: 0, cashDrops: 0, cashIn: 0, openingFloat: 0, expectedCash: 0, actualCash: 0, variance: 0, paymentCount: 0 });
    const controls = { sessionCount: allCashiers.length, paymentCount: totals.paymentCount, submittedCount: allCashiers.filter((cashier) => cashier.actualCash !== 0 || cashier.status !== 'OPEN').length, approvedCount: allCashiers.filter((cashier) => cashier.supervisorApproval === 'APPROVED').length, exceptionCount: allCashiers.reduce((sum, cashier) => sum + Number(cashier.exceptionCount || 0), 0) + allCashiers.filter((cashier) => Math.abs(cashier.variance) > 0.01).length };

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      cashiers: allCashiers,
      totals,
      controls
    });

  } catch (err: any) {
    console.error('[Cashier Summary GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
