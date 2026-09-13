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

    // 1. Voids: Folio items that have been voided
    const voidsData = await prisma.folioItem.findMany({
      where: { folio: { propertyId }, businessDate, voidedAt: { not: null } },
      include: { folio: { include: { guest: true, reservation: { include: { reservationRooms: { include: { room: true } } } } } } }
    });

    // 2. Refunds
    const refundsData = await prisma.refund.findMany({
      where: { propertyId, businessDate, status: 'COMPLETED' },
      include: { folio: { include: { guest: true, reservation: { include: { reservationRooms: { include: { room: true } } } } } } }
    });

    // 3. Discounts: Folio items marked as discount
    const discountsData = await prisma.folioItem.findMany({
      where: { folio: { propertyId }, businessDate, type: 'DISCOUNT', voidedAt: null },
      include: { folio: { include: { guest: true, reservation: { include: { reservationRooms: { include: { room: true } } } } } } }
    });

    // 4. Comps
    const compsData = await prisma.complimentaryRecord.findMany({
      where: { propertyId, businessDate },
      include: {
        operator: { select: { firstName: true, lastName: true } },
        approver: { select: { firstName: true, lastName: true } }
      }
    });

    const formatGuestName = (guest: any) => guest ? `${guest.firstName} ${guest.lastName}` : 'Walk-in';

    const exceptions = {
      voids: voidsData.map(v => ({
        id: v.id,
        timestamp: v.voidedAt,
        folioId: v.folio.folioNumber || v.folio.id.slice(0, 8),
        guestName: formatGuestName(v.folio.guest),
        amount: Number(v.amount),
        reason: v.voidReason || 'No reason provided',
        operator: 'System/Unknown'
      })),
      refunds: refundsData.map(r => ({
        id: r.id,
        timestamp: r.createdAt,
        folioId: r.folio.folioNumber || r.folio.id.slice(0, 8),
        guestName: formatGuestName(r.folio.guest),
        amount: Number(r.amount),
        reason: r.reason,
        operator: 'System/Unknown' // Since refunds model doesn't directly link to user names easily here, we could join User but omitting for simplicity
      })),
      discounts: discountsData.map(d => ({
        id: d.id,
        timestamp: d.createdAt,
        folioId: d.folio.folioNumber || d.folio.id.slice(0, 8),
        guestName: formatGuestName(d.folio.guest),
        amount: Number(d.amount),
        reason: d.description,
        operator: 'System/Unknown'
      })),
      comps: compsData.map(c => ({
        id: c.id,
        timestamp: c.createdAt,
        folioId: c.reference,
        guestName: 'N/A', // Comps might not be guest-linked directly in this query
        amount: Number(c.complAmount),
        reason: c.reason,
        operator: c.operator ? `${c.operator.firstName} ${c.operator.lastName}` : 'System'
      }))
    };

    const totals = {
      voids: exceptions.voids.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      refunds: exceptions.refunds.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      discounts: exceptions.discounts.reduce((sum, item) => sum + Math.abs(item.amount), 0),
      comps: exceptions.comps.reduce((sum, item) => sum + Math.abs(item.amount), 0),
    };

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      exceptions,
      totals,
      grandTotal: totals.voids + totals.refunds + totals.discounts + totals.comps
    });

  } catch (err: any) {
    console.error('[Exceptions Report GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
