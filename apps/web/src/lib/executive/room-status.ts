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
  contextualNote: string | null;
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
    select: { roomId: true, status: true, checkIn: true }
  });

  // Fetch current active blocks
  const activeBlocks = await prisma.roomBlock.findMany({
    where: {
      propertyId,
      status: 'ACTIVE',
      startDate: { lte: endOfDay },
      endDate: { gte: startOfDay }
    },
    select: { roomId: true, type: true, reason: true, notes: true }
  });

  // Map for quick lookups
  const reservationMap = new Map(activeReservations.map((r: any) => [r.roomId, r]));
  const blockMap = new Map(activeBlocks.map((b: any) => [b.roomId, b]));
  
  const occupiedRoomIds = new Set(activeReservations.map((r: any) => r.roomId));
  const oooRoomIds = new Set(activeBlocks.filter((b: any) => b.type === 'OUT_OF_ORDER').map((b: any) => b.roomId));
  const oosRoomIds = new Set(activeBlocks.filter((b: any) => b.type === 'OUT_OF_SERVICE').map((b: any) => b.roomId));

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
    // Every active room must resolve to one of these statuses — no silent fallback.
    let displayStatus: RoomDisplayStatus;

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

    let contextualNote: string | null = null;
    if (isOOO || isOOS) {
      const block = blockMap.get(room.id);
      if (block) {
        contextualNote = [block.reason, block.notes].filter(Boolean).join(' · ');
      }
    } else if (isOccupied) {
      const res = reservationMap.get(room.id);
      if (res && res.checkIn) {
        const checkInFmt = res.checkIn.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        contextualNote = `Guest checked in · ${checkInFmt}`;
      } else {
        contextualNote = 'Guest checked in';
      }
    } else if (displayStatus === 'DIRTY') {
      contextualNote = `Housekeeping: ${room.housekeepingStatus}`;
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
      maintenanceStatus: room.maintenanceStatus,
      contextualNote
    });
  }

  return {
    overview,
    rooms: detailedRooms
  };
}

export interface RoomIntelligenceData {
  room: {
    id: string;
    number: string;
    roomType: { id: string; name: string; };
    displayStatus: RoomDisplayStatus;
    availabilityStatus: RoomAvailabilityStatus;
    sellability: 'READY_TO_SELL' | 'NOT_READY' | 'NOT_SELLABLE';
    housekeepingStatus: string;
    maintenanceStatus: string;
    contextualNote: string | null;
  };
  currentGuest: {
    name: string | null;
    guests: number;
    vipLevel: string | null;
    checkIn: string;
    checkOut: string;
    folioBalance: number | null;
    folio: {
      totalCharges: number;
      paid: number;
      credit: number;
      balance: number;
    } | null;
  } | null;
  nextArrival: {
    reservationId: string;
    guest: { name: string | null; };
    arrivalDate: string;
    arrivalTime: string | null;
    nights: number;
    status: string;
  } | null;
  housekeeping: {
    status: string;
    lastUpdatedAt: string | null;
    assignedTo: string | null;
  };
  maintenance: {
    status: string;
    priority: string;
    reason: string;
    reportedAt: string | null;
    expectedResolutionAt: string | null;
  } | null;
  timeline: Array<{
    type: string;
    title: string;
    subtitle: string;
    timestamp: string;
  }>;
  managementAttention: {
    type: 'WARNING' | 'CRITICAL';
    message: string;
  } | null;
}

export async function getRoomIntelligenceView(
  roomId: string, 
  propertyId: string, 
  businessDate: Date,
  permissions: string[]
): Promise<RoomIntelligenceData | null> {
  const startOfDay = new Date(businessDate);
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

  const room = await prisma.room.findFirst({
    where: { id: roomId, propertyId },
    include: {
      roomType: { select: { id: true, name: true } },
      property: { select: { checkInTime: true } }
    }
  });

  if (!room) return null;

  // Calculate canonical status directly for this room (same logic as calculateRoomStatuses)
  const activeOccupancy = await prisma.reservationRoom.findFirst({
    where: {
      roomId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      checkIn: { lt: endOfDay },
      checkOut: { gt: startOfDay }
    },
    select: { id: true }
  });

  const activeBlock = await prisma.roomBlock.findFirst({
    where: {
      roomId,
      status: 'ACTIVE',
      startDate: { lte: endOfDay },
      endDate: { gte: startOfDay }
    }
  });

  const isOccupied = !!activeOccupancy;
  const isOOO = activeBlock?.type === 'OUT_OF_ORDER';
  const isOOS = activeBlock?.type === 'OUT_OF_SERVICE';
  const isClean = room.housekeepingStatus === 'CLEAN' || room.housekeepingStatus === 'INSPECTED';

  let displayStatus: RoomDisplayStatus;
  let availabilityStatus: RoomAvailabilityStatus;

  if (isOOO) {
    displayStatus = 'OUT_OF_ORDER';
    availabilityStatus = 'UNAVAILABLE';
  } else if (isOOS) {
    displayStatus = 'OUT_OF_SERVICE';
    availabilityStatus = 'UNAVAILABLE';
  } else if (isOccupied) {
    displayStatus = 'OCCUPIED';
    availabilityStatus = 'OCCUPIED';
  } else if (isClean) {
    displayStatus = 'READY';
    availabilityStatus = 'VACANT';
  } else {
    displayStatus = 'DIRTY';
    availabilityStatus = 'VACANT';
  }

  let sellability: 'READY_TO_SELL' | 'NOT_READY' | 'NOT_SELLABLE';
  if (displayStatus === 'READY') {
    sellability = 'READY_TO_SELL';
  } else if (displayStatus === 'OUT_OF_ORDER' || displayStatus === 'OUT_OF_SERVICE') {
    sellability = 'NOT_SELLABLE';
  } else {
    sellability = 'NOT_READY';
  }

  // Current Guest (Occupied tonight)
  const currentRes = await prisma.reservationRoom.findFirst({
    where: {
      roomId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      checkIn: { lt: endOfDay },
      checkOut: { gt: startOfDay }
    },
    include: {
      reservation: {
        include: { 
          primaryGuest: true, 
          folios: { include: { items: { where: { voidedAt: null } } } } 
        }
      }
    }
  });

  let currentGuest = null;
  if (currentRes && permissions.includes('rooms.guest.view')) {
    const showFolio = permissions.includes('rooms.folio.view');
    let folioData = null;
    
    if (showFolio && currentRes.reservation.folios.length > 0) {
      let totalCharges = 0;
      let totalPaid = 0;
      let balance = 0;

      for (const folio of currentRes.reservation.folios) {
        balance += Number(folio.balance);
        for (const item of folio.items) {
          if (item.type === 'CHARGE') totalCharges += Number(item.amount);
          if (item.type === 'PAYMENT') totalPaid += Number(item.amount);
          // Credit is basically negative balance if overpaid, but we can just use balance
        }
      }
      
      folioData = {
        totalCharges,
        paid: totalPaid,
        credit: balance < 0 ? Math.abs(balance) : 0,
        balance
      };
    }

    currentGuest = {
      name: `${currentRes.reservation.primaryGuest.firstName} ${currentRes.reservation.primaryGuest.lastName}`,
      guests: currentRes.adults || 1,
      vipLevel: currentRes.reservation.primaryGuest.vipLevel ?? null,
      checkIn: currentRes.checkIn.toISOString(),
      checkOut: currentRes.checkOut.toISOString(),
      folio: folioData,
      folioBalance: folioData?.balance ?? null
    };
  } else if (currentRes) {
    // Guest exists but caller lacks rooms.guest.view permission
    currentGuest = {
      name: null,
      guests: currentRes.adults || 1,
      vipLevel: null,
      checkIn: currentRes.checkIn.toISOString(),
      checkOut: currentRes.checkOut.toISOString(),
      folio: null,
      folioBalance: null
    };
  }

  // Next Arrival (Next reservation strictly AFTER today or checking in today but not currently occupying)
  // If currentRes exists, next arrival is checkIn >= currentRes.checkOut. 
  // If no currentRes, next arrival is checkIn >= startOfDay.
  const nextArrivalRes = await prisma.reservationRoom.findFirst({
    where: {
      roomId,
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
      checkIn: { gte: currentRes ? currentRes.checkOut : startOfDay }
    },
    orderBy: { checkIn: 'asc' },
    include: {
      reservation: { include: { primaryGuest: true } }
    }
  });

  let nextArrival = null;
  if (nextArrivalRes) {
    const nights = Math.round((nextArrivalRes.checkOut.getTime() - nextArrivalRes.checkIn.getTime()) / (1000 * 60 * 60 * 24));
    nextArrival = {
      reservationId: nextArrivalRes.reservationId,
      guest: {
        name: permissions.includes('rooms.guest.view') 
          ? `${nextArrivalRes.reservation.primaryGuest.firstName} ${nextArrivalRes.reservation.primaryGuest.lastName}` 
          : null
      },
      arrivalDate: nextArrivalRes.checkIn.toISOString().split('T')[0],
      arrivalTime: room.property.checkInTime,
      nights,
      status: nextArrivalRes.status
    };
  }

  // Housekeeping — resolve assigned staff name from Staff table
  const hkTask = await prisma.housekeepingTask.findFirst({
    where: { roomId },
    orderBy: { createdAt: 'desc' }
  });

  let assignedStaffName: string | null = null;
  if (hkTask?.assignedTo) {
    const staff = await prisma.staff.findUnique({
      where: { id: hkTask.assignedTo },
      select: { firstName: true, lastName: true }
    });
    assignedStaffName = staff ? `${staff.firstName} ${staff.lastName}` : null;
  }

  const housekeeping = {
    status: room.housekeepingStatus,
    lastUpdatedAt: hkTask ? hkTask.updatedAt.toISOString() : null,
    assignedTo: assignedStaffName
  };

  // Maintenance — reuse activeBlock already fetched for status calculation above


  let maintenance = null;
  if (activeBlock) {
    maintenance = {
      status: activeBlock.status,
      priority: activeBlock.notes ?? 'NORMAL',
      reason: activeBlock.reason,
      reportedAt: activeBlock.createdAt.toISOString(),
      expectedResolutionAt: activeBlock.endDate.toISOString()
    };
  }

  // Timeline — pull from RoomStatusHistory for authoritative audit trail
  const historyRecords = await prisma.roomStatusHistory.findMany({
    where: { roomId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const formatStatus = (s: string) => {
    if (!s) return '';
    return s.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  };

  const timeline = historyRecords.map((record: any) => ({
    type: record.source,
    title: `Status changed: ${formatStatus(record.previousStatus)} → ${formatStatus(record.newStatus)}`,
    subtitle: record.reason ?? '',
    timestamp: record.createdAt.toISOString()
  }));

  // Management Attention derived from multiple conditions
  let managementAttention: { type: 'WARNING' | 'CRITICAL', message: string } | null = null;
  
  if (isOOO || isOOS) {
    const hours = Math.round((new Date().getTime() - activeBlock!.createdAt.getTime()) / 3600000);
    let msg = `${isOOO ? 'OOO' : 'OOS'} for ${hours} hours`;
    if (nextArrivalRes) {
      const daysToArrival = Math.round((nextArrivalRes.checkIn.getTime() - new Date().getTime()) / 86400000);
      if (daysToArrival === 0) msg += ' · Next arrival today';
      else if (daysToArrival === 1) msg += ' · Next arrival tomorrow';
    }
    managementAttention = { type: 'CRITICAL', message: msg };
  } else if (displayStatus === 'DIRTY' && nextArrivalRes) {
    const daysToArrival = Math.round((nextArrivalRes.checkIn.getTime() - new Date().getTime()) / 86400000);
    if (daysToArrival === 0) {
      managementAttention = { type: 'WARNING', message: 'Next arrival today, but room is still dirty' };
    }
  }

  return {
    room: {
      id: room.id,
      number: room.number,
      roomType: { id: room.roomType.id, name: room.roomType.name },
      displayStatus,
      availabilityStatus,
      sellability,
      housekeepingStatus: room.housekeepingStatus,
      maintenanceStatus: room.maintenanceStatus,
      contextualNote: null // Contextual note is already provided in timeline/management attention for Details
    },
    currentGuest,
    nextArrival,
    housekeeping,
    maintenance,
    timeline,
    managementAttention
  };
}
