import prisma from '@hotel-pms/db';

type DbClient = typeof prisma;

export function activeOccupancyWhere(propertyId: string, _businessDate?: Date) {
  return {
    reservation: {
      propertyId,
      status: 'CHECKED_IN' as const,
    },
    status: 'ACTIVE',
    roomId: { not: null },
  };
}

/**
 * Makes the physical room table agree with active checked-in room assignments.
 * Reservation status is authoritative: a CHECKED_IN reservation keeps its
 * assigned room OCCUPIED regardless of the planned checkout date. Rooms are
 * not released here; only the checkout workflow may move them to CLEANING or
 * another post-checkout state.
 */
export async function reconcileRoomOccupancy(
  propertyId: string,
  businessDate: Date,
  db: DbClient = prisma,
) {
  const assignments = await db.reservationRoom.findMany({
    where: activeOccupancyWhere(propertyId, businessDate),
    select: { roomId: true },
  });
  const occupiedRoomIds = new Set(assignments.map((assignment) => assignment.roomId).filter(Boolean) as string[]);

  const rooms = await db.room.findMany({
    where: { propertyId, isActive: true },
    select: { id: true, status: true },
  });

  let occupied = 0;

  for (const room of rooms) {
    const shouldBeOccupied = occupiedRoomIds.has(room.id);

    if (shouldBeOccupied) {
      occupied++;
      if (room.status !== 'OCCUPIED') {
        await db.room.update({ where: { id: room.id }, data: { status: 'OCCUPIED' } });
      }
      continue;
    }
  }

  return { occupied };
}
