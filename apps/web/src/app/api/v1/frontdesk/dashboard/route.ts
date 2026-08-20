import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import prisma from '@hotel-pms/db';
import { successResponse, errorResponse } from '@/lib/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return errorResponse('UNAUTHORIZED', 'Unauthorized', 401);

    const url = new URL(req.url);
    const propertyId = url.searchParams.get('propertyId');
    if (!propertyId) return errorResponse('BAD_REQUEST', 'Property ID is required', 400);

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property) return errorResponse('NOT_FOUND', 'Property not found', 404);

    // 1. Get today's business date in the property's timezone
    const tz = property.timezone || 'Africa/Lagos';
    const todayString = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date()); // YYYY-MM-DD
    
    // Parse into UTC boundaries for the property's "Today"
    const businessDate = new Date(`${todayString}T00:00:00.000Z`); // Used as Prisma @db.Date representation

    // 2. Fetch KPIs
    const [arrivalsCount, departuresCount, inHouseCount, hardwareAgent, rooms] = await Promise.all([
      // Arrivals: checking in today
      prisma.reservation.count({
        where: { propertyId, checkIn: businessDate, status: { notIn: ['CANCELLED', 'NO_SHOW'] } }
      }),
      // Departures: checking out today
      prisma.reservation.count({
        where: { propertyId, checkOut: businessDate, status: { notIn: ['CANCELLED', 'NO_SHOW'] } }
      }),
      // In-House: Currently Checked In
      prisma.reservation.count({
        where: { propertyId, status: 'CHECKED_IN' }
      }),
      // Hardware Status
      prisma.hardwareAgent.findFirst({
        where: { propertyId, enabled: true },
        orderBy: { lastHeartbeat: 'desc' }
      }),
      // Room stats
      prisma.room.findMany({
        where: { propertyId, isActive: true },
        select: { status: true }
      })
    ]);

    const totalRooms = rooms.length;
    const availableRooms = rooms.filter((r: any) => r.status === 'AVAILABLE' || r.status === 'CLEAN').length;

    let encoderStatus = 'OFFLINE';
    let encoderMessage = 'Check the front-desk hardware connection.';
    let agentName = hardwareAgent ? hardwareAgent.name : 'Windows Lock Agent';
    if (hardwareAgent && hardwareAgent.lastHeartbeat) {
      const diffSecs = (Date.now() - hardwareAgent.lastHeartbeat.getTime()) / 1000;
      if (diffSecs < 60) {
        encoderStatus = 'ONLINE';
        encoderMessage = `${agentName} · Last heartbeat: ${Math.floor(diffSecs)} seconds ago`;
      } else {
        encoderMessage = `Last seen ${Math.floor(diffSecs / 60)} minutes ago`;
      }
    }

    // 3. Fetch Detailed Arrivals List
    const arrivals = await prisma.reservation.findMany({
      where: { propertyId, checkIn: businessDate, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      include: {
        primaryGuest: true,
        reservationRooms: { include: { room: { include: { roomType: true } } } },
        folios: true
      }
    });

    // 4. Fetch Detailed Departures List
    const departures = await prisma.reservation.findMany({
      where: { propertyId, checkOut: businessDate, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
      include: {
        primaryGuest: true,
        reservationRooms: { include: { room: true } },
        folios: true
      }
    });

    const formatGuestList = (resList: any[]) => resList.map(res => {
      const folio = res.folios?.[0];
      const balance = folio ? Math.abs(Number(folio.balance || 0)) : null;
      
      let arrivalStatus = 'Ready';
      let arrivalColor = 'green';
      
      if (res.status === 'CHECKED_IN') {
        arrivalStatus = 'Checked In';
        arrivalColor = 'blue';
      } else if (balance !== null && balance > 0) {
        arrivalStatus = 'Payment Due';
        arrivalColor = 'yellow';
      } else if (!res.reservationRooms?.[0]?.room) {
        arrivalStatus = 'Unassigned';
        arrivalColor = 'yellow';
      } else if (res.reservationRooms[0].room.status === 'OUT_OF_ORDER' || res.reservationRooms[0].room.status === 'MAINTENANCE') {
        arrivalStatus = 'Room Issue';
        arrivalColor = 'red';
      }

      const roomStatus = res.reservationRooms?.[0]?.room?.status || 'UNKNOWN';

      return {
        id: res.id,
        guestName: res.primaryGuest ? `${res.primaryGuest.firstName} ${res.primaryGuest.lastName}` : 'Unknown',
        confirmationNumber: res.confirmationNumber,
        roomName: res.reservationRooms?.[0]?.room?.number || 'Unassigned',
        roomTypeName: res.reservationRooms?.[0]?.room?.roomType?.name || '',
        arrivalTime: property.checkInTime || '14:00', // Uses property config instead of hardcoded time
        balance,
        status: res.status,
        arrivalState: { label: arrivalStatus, color: arrivalColor },
        roomStatus
      };
    });

    return successResponse({
      property: {
        name: property.name,
      },
      businessDate: businessDate.toISOString(),
      kpis: {
        arrivals: arrivalsCount,
        departures: departuresCount,
        inHouse: inHouseCount,
        roomsAvailable: availableRooms,
        roomsTotal: totalRooms
      },
      hardware: {
        status: encoderStatus,
        message: encoderMessage,
        name: agentName
      },
      arrivals: formatGuestList(arrivals),
      departures: formatGuestList(departures)
    });

  } catch (err) {
    console.error('[FrontDesk Dashboard GET]', err);
    return errorResponse('INTERNAL_ERROR', 'Unexpected error', 500);
  }
}
