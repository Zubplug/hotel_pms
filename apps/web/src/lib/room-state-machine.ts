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
  AVAILABLE: ['RESERVED', 'MAINTENANCE', 'BLOCKED', 'OUT_OF_ORDER', 'OUT_OF_SERVICE', 'DIRTY'],
  RESERVED: ['OCCUPIED', 'AVAILABLE', 'DIRTY', 'MAINTENANCE'],
  OCCUPIED: ['DIRTY', 'MAINTENANCE', 'AVAILABLE'], // Added AVAILABLE for quick checkout overrides
  DIRTY: ['CLEANING', 'AVAILABLE', 'MAINTENANCE', 'CLEAN'], // Added CLEAN for quick overrides
  CLEANING: ['CLEAN', 'DIRTY', 'MAINTENANCE'],
  CLEAN: ['INSPECTED', 'DIRTY', 'AVAILABLE', 'MAINTENANCE'], // Added AVAILABLE for fast-tracking
  INSPECTED: ['AVAILABLE', 'DIRTY', 'MAINTENANCE'],
  MAINTENANCE: ['OUT_OF_ORDER', 'AVAILABLE', 'DIRTY', 'CLEAN'],
  OUT_OF_ORDER: ['MAINTENANCE', 'AVAILABLE', 'DIRTY'],
  OUT_OF_SERVICE: ['AVAILABLE', 'DIRTY'],
  BLOCKED: ['AVAILABLE', 'DIRTY'],
};

export function isValidTransition(from: RoomStatus, to: RoomStatus, override = false): boolean {
  if (override) return true;
  return TRANSITIONS[from]?.includes(to) ?? false;
}

export function getAllowedTransitions(from: RoomStatus): RoomStatus[] {
  // Return all common statuses plus any strictly allowed ones to populate dropdowns easily
  const common = ['AVAILABLE', 'CLEAN', 'DIRTY', 'MAINTENANCE'] as RoomStatus[];
  const specific = TRANSITIONS[from] ?? [];
  return Array.from(new Set([...common, ...specific]));
}

export type { RoomStatus };
