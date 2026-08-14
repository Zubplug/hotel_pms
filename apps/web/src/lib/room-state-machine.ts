type RoomStatus =
  | 'AVAILABLE'
  | 'RESERVED'
  | 'OCCUPIED'
  | 'DIRTY'
  | 'CLEANING'
  | 'CLEAN'
  | 'INSPECTED'
  | 'OUT_OF_ORDER'
  | 'OUT_OF_SERVICE'
  | 'MAINTENANCE'
  | 'BLOCKED';

// Authoritative server-side state machine.
// Any status transition not listed here is FORBIDDEN.
const TRANSITIONS: Record<RoomStatus, RoomStatus[]> = {
  AVAILABLE: ['RESERVED', 'MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE'],
  RESERVED: ['OCCUPIED', 'AVAILABLE'],
  OCCUPIED: ['DIRTY'],
  DIRTY: ['CLEANING', 'AVAILABLE'],
  CLEANING: ['CLEAN'],
  CLEAN: ['INSPECTED', 'DIRTY'],
  INSPECTED: ['AVAILABLE', 'DIRTY'],
  MAINTENANCE: ['OUT_OF_ORDER', 'AVAILABLE'],
  OUT_OF_ORDER: ['MAINTENANCE', 'AVAILABLE'],
  OUT_OF_SERVICE: ['AVAILABLE'],
  BLOCKED: ['AVAILABLE'],
};

export function isValidTransition(from: RoomStatus, to: RoomStatus): boolean {
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(from: RoomStatus): RoomStatus[] {
  return TRANSITIONS[from] ?? [];
}

export type { RoomStatus };
