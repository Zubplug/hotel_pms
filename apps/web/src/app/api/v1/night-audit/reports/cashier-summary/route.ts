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

      let cashSales = 0, cardSales = 0, bankTransfer = 0, other = 0;
      paymentsAggr.forEach(p => {
        const amt = Number(p._sum.amount || 0);
        if (p.method === 'CASH') cashSales += amt;
        else if (p.method === 'CARD') cardSales += amt;
        else if (p.method === 'BANK_TRANSFER') bankTransfer += amt;
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

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      cashiers
    });

  } catch (err: any) {
    console.error('[Cashier Summary GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
