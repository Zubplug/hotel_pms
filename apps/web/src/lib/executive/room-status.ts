import { prisma } from '@hotel-pms/db';

export type RoomDisplayStatus = 'READY' | 'OCCUPIED' | 'DIRTY' | 'OUT_OF_ORDER' | 'OUT_OF_SERVICE' | 'UNKNOWN';
export type RoomAvailabilityStatus = 'VACANT' | 'OCCUPIED' | 'UNAVAILABLE';

export interface RoomDetailedStatus {
  id: string;
  number: string;
  roomType: {
    id: string;
    name: string;
  };
  displayStatus: RoomDisplayStatus;
  availabilityStatus: RoomAvailabilityStatus;
  housekeepingStatus: string;
  maintenanceStatus: string;
}

export interface RoomStatusOverview {
  total: number;
  occupied: number;
  vacant: number;
  ready: number;
  dirty: number;
  outOfOrder: number;
  outOfService: number;
}

export interface RoomStatusResult {
  overview: RoomStatusOverview;
  rooms: RoomDetailedStatus[];
}

export async function calculateRoomStatuses(propertyId: string, businessDate: Date): Promise<RoomStatusResult> {
  const startOfDay = new Date(businessDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  // Fetch all physical rooms
  const allRooms = await prisma.room.findMany({
    where: { propertyId, isActive: true },
    include: {
      roomType: { select: { id: true, name: true } }
    },
    orderBy: { number: 'asc' }
  });

  // Fetch current active reservations
  const activeReservations = await prisma.reservationRoom.findMany({
    where: {
      room: { propertyId },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      checkIn: { lt: endOfDay },
      checkOut: { gt: startOfDay }
    },
    select: { roomId: true, status: true }
  });

  // Fetch current active blocks
  const activeBlocks = await prisma.roomBlock.findMany({
    where: {
      propertyId,
      status: 'ACTIVE',
      startDate: { lte: endOfDay },
      endDate: { gte: startOfDay }
    },
    select: { roomId: true, type: true }
  });

  // Map for quick lookups
  const occupiedRoomIds = new Set(activeReservations.map(r => r.roomId));
  const oooRoomIds = new Set(activeBlocks.filter(b => b.type === 'OUT_OF_ORDER').map(b => b.roomId));
  const oosRoomIds = new Set(activeBlocks.filter(b => b.type === 'OUT_OF_SERVICE').map(b => b.roomId));

  const overview = {
    total: allRooms.length,
    occupied: 0,
    vacant: 0,
    ready: 0,
    dirty: 0,
    outOfOrder: 0,
    outOfService: 0
  };

  const detailedRooms: RoomDetailedStatus[] = [];

  for (const room of allRooms) {
    const isOccupied = occupiedRoomIds.has(room.id);
    const isOOO = oooRoomIds.has(room.id);
    const isOOS = oosRoomIds.has(room.id);
    
    // Determine Availability Status
    let availabilityStatus: RoomAvailabilityStatus = 'VACANT';
    if (isOccupied) {
      availabilityStatus = 'OCCUPIED';
    } else if (isOOO || isOOS) {
      availabilityStatus = 'UNAVAILABLE';
    }

    // Determine Housekeeping Status
    // Assume PENDING/ASSIGNED/CLEANING as 'DIRTY' logically for readiness, 
    // but the DB value is room.housekeepingStatus.
    const isClean = room.housekeepingStatus === 'CLEAN' || room.housekeepingStatus === 'INSPECTED';

    // Determine Display Status (Canonical)
    let displayStatus: RoomDisplayStatus = 'UNKNOWN';

    if (isOOO) {
      displayStatus = 'OUT_OF_ORDER';
      overview.outOfOrder++;
    } else if (isOOS) {
      displayStatus = 'OUT_OF_SERVICE';
      overview.outOfService++;
    } else if (isOccupied) {
      displayStatus = 'OCCUPIED';
      overview.occupied++;
    } else if (isClean) {
      displayStatus = 'READY';
      overview.ready++;
      overview.vacant++;
    } else {
      displayStatus = 'DIRTY';
      overview.dirty++;
      overview.vacant++;
    }

    detailedRooms.push({
      id: room.id,
      number: room.number,
      roomType: {
        id: room.roomType.id,
        name: room.roomType.name
      },
      displayStatus,
      availabilityStatus,
      housekeepingStatus: room.housekeepingStatus,
      maintenanceStatus: room.maintenanceStatus
    });
  }

  return {
    overview,
    rooms: detailedRooms
  };
}
