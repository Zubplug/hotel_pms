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

    // Fetch POS sessions for this business date
    const sessions = await prisma.posSession.findMany({
      where: { propertyId, businessDate },
      include: {
        outlet: true,
        orders: {
          include: {
            items: true,
            payments: true
          }
        }
      }
    });

    const outletsMap: Record<string, any> = {};

    let grandGross = 0;
    let grandDiscounts = 0;
    let grandNet = 0;
    let grandTaxes = 0;
    let grandTotal = 0;
    let grandRoomCharges = 0;
    let grandExpected = 0;
    let grandActual = 0;

    sessions.forEach(session => {
      const outletId = session.outletId;
      if (!outletsMap[outletId]) {
        outletsMap[outletId] = {
          outletName: session.outlet.name,
          grossSales: 0,
          discounts: 0,
          netSales: 0,
          taxes: 0,
          totalSales: 0,
          roomCharges: 0,
          expectedCash: 0,
          actualCash: 0,
          variance: 0,
          sessions: []
        };
      }

      const out = outletsMap[outletId];
      let sGross = 0;
      let sDisc = 0;
      let sNet = 0;
      let sTax = 0;
      let sTotal = 0;
      let sRoom = 0;

      session.orders.forEach(order => {
        if (order.status !== 'VOIDED') {
          sGross += Number(order.subtotal || 0);
          sDisc += Number(order.discount || 0);
          sTax += Number(order.taxAmount || 0);
          sTotal += Number(order.total || 0);
          sNet = sGross - sDisc;

          order.payments.forEach(p => {
            if (p.method === 'ROOM_CHARGE' && p.status === 'PAID') {
              sRoom += Number(p.amount);
            }
          });
        }
      });

      const sExpected = Number(session.expectedCash || 0);
      const sActual = Number(session.actualCash || 0);
      const sVar = Number(session.variance || 0);

      out.grossSales += sGross;
      out.discounts += sDisc;
      out.netSales += sNet;
      out.taxes += sTax;
      out.totalSales += sTotal;
      out.roomCharges += sRoom;
      out.expectedCash += sExpected;
      out.actualCash += sActual;
      out.variance += sVar;

      grandGross += sGross;
      grandDiscounts += sDisc;
      grandNet += sNet;
      grandTaxes += sTax;
      grandTotal += sTotal;
      grandRoomCharges += sRoom;
      grandExpected += sExpected;
      grandActual += sActual;

      out.sessions.push({
        id: session.id,
        gross: sGross,
        discount: sDisc,
        net: sNet,
        total: sTotal,
        expectedCash: sExpected,
        actualCash: sActual,
        variance: sVar,
        status: session.status
      });
    });

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      outlets: Object.values(outletsMap),
      totals: {
        gross: grandGross,
        discounts: grandDiscounts,
        net: grandNet,
        taxes: grandTaxes,
        total: grandTotal,
        roomCharges: grandRoomCharges,
        expectedCash: grandExpected,
        actualCash: grandActual,
        variance: grandActual - grandExpected
      }
    });

  } catch (err: any) {
    console.error('[POS Reconciliation GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
