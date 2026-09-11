import prisma from '@/lib/prisma';
import { startOfDay, addDays } from 'date-fns';

export interface AvailabilitySnapshot {
  date: Date;
  available: number;
  total: number;
}

export const AvailabilityService = {
  /**
   * Authoritative Availability Engine for LodgeCore.
   * Total Sellable Rooms - blocked/out-of-order inventory - assigned reservations - unassigned room-type reservations = available inventory
   */
  async getRoomTypeAvailability(propertyId: string, roomTypeId: string, startDate: Date, endDate: Date): Promise<AvailabilitySnapshot[]> {
    const snapshots: AvailabilitySnapshot[] = [];
    
    // 1. Get total physical rooms for this type
    const physicalRooms = await prisma.room.findMany({
      where: { propertyId, roomTypeId, isActive: true }
    });
    const totalInventory = physicalRooms.length;

    let current = startOfDay(startDate);
    const end = startOfDay(endDate);

    while (current <= end) {
      // 2. Find blocks/maintenance for this specific date
      const activeBlocks = await prisma.roomBlock.count({
        where: {
          propertyId,
          roomId: { in: physicalRooms.map(r => r.id) },
          status: 'ACTIVE',
          startDate: { lte: current },
          endDate: { gte: current }
        }
      });

      // 3. Find all active reservations (both assigned AND unassigned) that span this date.
      // Check-out day does not consume inventory for that night, just like existing LodgeCore logic.
      const activeReservations = await prisma.reservationRoom.count({
        where: {
          roomTypeId: roomTypeId,
          status: 'ACTIVE',
          checkIn: { lte: current },
          checkOut: { gt: current },
          reservation: {
             propertyId: propertyId,
             status: { notIn: ['CANCELLED', 'NO_SHOW'] }
          }
        }
      });

      const available = Math.max(0, totalInventory - activeBlocks - activeReservations);

      snapshots.push({
        date: current,
        available,
        total: totalInventory
      });

      current = addDays(current, 1);
    }

    return snapshots;
  }
};
