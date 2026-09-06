import { NextResponse } from 'next/server';
import { requireOrganizationContext } from '@/lib/organization-access';
import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { successResponse, errorResponse } from '@/lib/api-response';
import prisma from '@hotel-pms/db';
import { format } from 'date-fns';

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

    const reservations = await prisma.reservation.findMany({
      where: { propertyId, status: 'CHECKED_IN' },
      include: {
        primaryGuest: true,
        reservationRooms: { include: { room: true } },
        folios: true
      }
    });

    let occupiedRooms = 0;
    let guestsInHouse = 0;
    let outstandingBalances = 0;
    let availableCredits = 0;

    const guests = reservations.map(res => {
      const roomNum = res.reservationRooms[0]?.room?.number || 'Unassigned';
      const rType = res.reservationRooms[0]?.room?.roomTypeId ? 'Assigned' : 'Unassigned';
      const adults = res.adults || 1;
      const children = res.children || 0;
      const balance = Number(res.folios[0]?.balance || 0);
      
      occupiedRooms++;
      guestsInHouse += (adults + children);
      
      if (balance > 0) outstandingBalances += balance;
      else if (balance < 0) availableCredits += Math.abs(balance);

      let paymentStatus = 'UNPAID';
      if (balance <= 0) paymentStatus = 'PAID';
      else if (balance > 0 && balance < Number(res.folios[0]?.balance || 0) + 100) paymentStatus = 'PARTIAL'; // Mock logic

      return {
        room: roomNum,
        guestName: `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}`,
        reservationRef: res.id.slice(-6).toUpperCase(),
        arrival: format(res.checkIn, 'yyyy-MM-dd'),
        departure: format(res.checkOut, 'yyyy-MM-dd'),
        adults,
        children,
        rate: Number(res.reservationRooms[0]?.rateAmount || 0),
        roomType: rType,
        folioBalance: balance,
        creditAvailable: balance < 0 ? Math.abs(balance) : 0,
        paymentStatus,
        vipStatus: res.primaryGuest.isVip ? (res.primaryGuest.vipLevel || 'VIP') : 'Regular'
      };
    });

    const totals = { occupiedRooms, guestsInHouse, outstandingBalances, availableCredits };

    return successResponse({
      propertyName: property?.name || 'Property',
      propertyEmail: property?.email || '',
      propertyPhone: property?.phone || '',
      propertyAddress: [property?.address, property?.city, property?.state].filter(Boolean).join(', '),
      propertyCurrency: property?.baseCurrency || 'NGN',
      businessDate: businessDateStr,
      auditStatus: nightAudit?.status || 'CLOSED',
      guests,
      totals
    });

  } catch (err: any) {
    console.error('[In House Guests GET]', err);
    return errorResponse('INTERNAL_ERROR', err.message, 500);
  }
}
