import { describe, it, expect } from 'vitest';
import { isValidTransition, getAllowedTransitions } from './room-state-machine';

describe('Room State Machine', () => {
  it('allows transition from AVAILABLE to RESERVED', () => {
    expect(isValidTransition('AVAILABLE', 'RESERVED')).toBe(true);
  });

  it('allows transition from OCCUPIED to DIRTY', () => {
    expect(isValidTransition('OCCUPIED', 'DIRTY')).toBe(true);
  });

  it('prevents invalid transitions', () => {
    // You cannot go straight from OCCUPIED to CLEAN, it must be DIRTY first
    expect(isValidTransition('OCCUPIED', 'CLEAN')).toBe(false);
  });

  it('returns all allowed transitions for a state', () => {
    const fromAvailable = getAllowedTransitions('AVAILABLE');
    expect(fromAvailable).toContain('RESERVED');
    expect(fromAvailable).toContain('MAINTENANCE');
    expect(fromAvailable).toContain('OUT_OF_ORDER');
    expect(fromAvailable).toContain('OUT_OF_SERVICE');
    expect(fromAvailable).not.toContain('CLEANING');
  });

  it('handles unknown states safely', () => {
    expect(isValidTransition('UNKNOWN' as any, 'AVAILABLE' as any)).toBe(false);
    expect(getAllowedTransitions('UNKNOWN' as any)).toEqual([]);
  });
});
