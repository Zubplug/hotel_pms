import prisma from '@hotel-pms/db';
import { startOfDay, addDays } from 'date-fns';

export interface AvailabilitySnapshot {
  date: Date;
  available: number;
  total: number;
}

export const AvailabilityService = {
  async getRoomTypeAvailability(propertyId: string, roomTypeId: string, startDate: Date, endDate: Date): Promise<AvailabilitySnapshot[]> {
    const snapshots: AvailabilitySnapshot[] = [];
    
    // 1. Get total physical rooms for this type
    const physicalRooms = await prisma.room.findMany({
      where: { propertyId, roomTypeId, isActive: true },
      select: { id: true }
    });
    const totalInventory = physicalRooms.length;
    const roomIds = physicalRooms.map(r => r.id);

    let current = startOfDay(startDate);
    const end = startOfDay(endDate);

    while (current <= end) {
      // 2. Find blocks for this specific date
      const activeBlocks = await prisma.roomBlock.findMany({
        where: {
          propertyId,
          roomId: { in: roomIds },
          status: 'ACTIVE',
          startDate: { lte: current },
          endDate: { gte: current } // Assuming inclusive.
        },
        select: { roomId: true }
      });
      const blockedRoomIds = new Set(activeBlocks.map(b => b.roomId));

      // 3. Find all active reservations that span this date.
      // (Checkout is exclusive, so checkOut > current)
      const activeReservations = await prisma.reservationRoom.findMany({
        where: {
          roomTypeId: roomTypeId,
          status: 'ACTIVE',
          checkIn: { lte: current },
          checkOut: { gt: current },
          reservation: {
             propertyId: propertyId,
             status: { notIn: ['CANCELLED', 'NO_SHOW'] }
          }
        },
        select: { roomId: true }
      });

      // 4. Calculate Unavailable
      const unavailablePhysicalRooms = new Set(blockedRoomIds);
      let floatingUnavailable = 0;

      for (const res of activeReservations) {
          if (res.roomId) {
              unavailablePhysicalRooms.add(res.roomId); // Add assigned rooms to physical unavailable set
          } else {
              floatingUnavailable++; // Unassigned OTA reservations
          }
      }

      const available = Math.max(0, totalInventory - unavailablePhysicalRooms.size - floatingUnavailable);

      snapshots.push({ date: current, available, total: totalInventory });
      current = addDays(current, 1);
    }
    return snapshots;
  }
};
