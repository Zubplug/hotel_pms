import prisma from '@hotel-pms/db';

export async function fetchHotelPulse(propertyId: string) {
  // Get start and end of today in UTC for simplicity. 
  // In a real production system, this should use the property's timezone.
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalRooms,
    occupiedRooms,
    outOfOrderRooms,
    reservationsToday
  ] = await Promise.all([
    prisma.room.count({
      where: { propertyId, isActive: true }
    }),
    prisma.room.count({
      where: { propertyId, isActive: true, status: 'OCCUPIED' }
    }),
    prisma.room.count({
      where: { propertyId, isActive: true, status: 'OUT_OF_ORDER' }
    }),
    prisma.reservation.findMany({
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
    })
  ]);

  let arrivalsToday = 0;
  let departuresToday = 0;
  let vipArrivals = 0;
  let inHouseGuests = 0; // rough estimation based on checked_in status

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
      inHouseGuests++; // We'd realistically sum adults + children here
    }
  }

  // Vacant rooms
  const vacantRooms = totalRooms - occupiedRooms - outOfOrderRooms;

  return {
    totalRooms,
    occupied: occupiedRooms,
    vacant: vacantRooms > 0 ? vacantRooms : 0,
    outOfOrder: outOfOrderRooms,
    arrivals: arrivalsToday,
    departures: departuresToday,
    inHouseGuests,
    vipArrivals
  };
}
