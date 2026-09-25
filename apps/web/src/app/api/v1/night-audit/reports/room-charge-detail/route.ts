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

    // Fetch FolioItems that are not ROOM_CHARGE, but are CHARGE type, 
    // and posted to a folio with an active reservation.
    const items = await prisma.folioItem.findMany({
      where: { 
        folio: { propertyId, reservationId: { not: null } },
        businessDate,
        type: 'CHARGE',
        source: { notIn: ['ROOM_CHARGE', 'DAY_USE_ROOM_CHARGE'] }
      },
      include: {
        folio: {
          include: {
            guest: true,
            reservation: {
              include: {
                reservationRooms: {
                  include: {
                    room: true
                  }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const roomChargesMap: Record<string, any> = {};
    let grandTotal = 0;

    items.forEach(item => {
      // Group by Source (e.g. POS, RESTAURANT, SPA, LAUNDRY)
      const source = item.source;
      if (!roomChargesMap[source]) {
        roomChargesMap[source] = {
          source,
          total: 0,
          charges: []
        };
      }

      const amt = Number(item.amount);
      const isVoided = !!item.voidedAt;
      
      if (!isVoided) {
        roomChargesMap[source].total += amt;
        grandTotal += amt;
      }

      roomChargesMap[source].charges.push({
        id: item.id,
        timestamp: item.createdAt,
        folioId: item.folio?.folioNumber || item.folio?.id.slice(0, 8) || 'N/A',
        guestName: item.folio?.guest ? `${item.folio.guest.firstName} ${item.folio.guest.lastName}` : 'Unknown Guest',
        roomNumber: item.folio?.reservation?.reservationRooms?.[0]?.room?.number || 'N/A',
        description: item.description,
        amount: amt,
        operator: 'Staff', // In a full implementation, we'd join Staff/User on postedBy
        posRef: item.posTransactionId || 'N/A',
        isVoided
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
      sources: Object.values(roomChargesMap),
      totals: {
        totalCharges: grandTotal
      }
    });

  } catch (err: any) {
    console.error('[Room-Charge Detail GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
