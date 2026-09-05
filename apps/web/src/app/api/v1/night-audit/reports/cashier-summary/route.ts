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

    const cashiers = sessions.map(session => {
      const openingFloat = Number(session.openingFloat || 0);
      const expectedCash = Number(session.systemExpectedCash || 0);
      const actualCash = Number(session.declaredCash || 0);
      const variance = Number(session.variance || (actualCash - expectedCash));

      return {
        cashierName: `${session.staff?.firstName || 'Unknown'} ${session.staff?.lastName || ''}`.trim(),
        shiftReference: session.shiftReference || session.id.slice(-6).toUpperCase(),
        status: session.status,
        openingFloat,
        cashSales: expectedCash - openingFloat, // Simplified mockup for sales
        cardSales: 0,
        bankTransfer: 0,
        other: 0,
        cashRefunds: 0,
        paidOuts: 0,
        cashDrops: actualCash,
        expectedCash,
        actualCash,
        variance,
        supervisorApproval: variance === 0 ? 'APPROVED' : 'PENDING'
      };
    });

    return successResponse({
      propertyName: property?.name || 'Property',
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
