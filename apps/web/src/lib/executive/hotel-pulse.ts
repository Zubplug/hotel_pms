import prisma from '@hotel-pms/db';
import { calculateRoomStatuses } from './room-status';

export async function fetchHotelPulse(propertyId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // 1. Get authoritative room statuses
  const { overview } = await calculateRoomStatuses(propertyId, today);

  // 2. Get today's arrivals, departures, and VIPs
  const reservationsToday = await prisma.reservation.findMany({
    where: {
      propertyId,
      status: { in: ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT'] },
      OR: [
        { checkIn: { gte: today, lt: tomorrow } },
        { checkOut: { gte: today, lt: tomorrow } },
      ]
    },
    select: {
      checkIn: true,
      checkOut: true,
      status: true,
      primaryGuest: { select: { isVip: true } }
    }
  });

  let arrivalsToday = 0;
  let departuresToday = 0;
  let vipArrivals = 0;
  let inHouseGuests = 0; 

  for (const res of reservationsToday) {
    const isCheckInToday = res.checkIn >= today && res.checkIn < tomorrow;
    const isCheckOutToday = res.checkOut >= today && res.checkOut < tomorrow;

    if (isCheckInToday) {
      arrivalsToday++;
      if (res.primaryGuest.isVip) {
        vipArrivals++;
      }
    }
    
    if (isCheckOutToday) {
      departuresToday++;
    }

    if (res.status === 'CHECKED_IN') {
      inHouseGuests++; 
    }
  }

  return {
    totalRooms: overview.total,
    occupied: overview.occupied,
    vacant: overview.vacant,
    outOfOrder: overview.outOfOrder,
    arrivals: arrivalsToday,
    departures: departuresToday,
    inHouseGuests,
    vipArrivals
  };
}
