import { describe, expect, it } from 'vitest';
import { reconcileOfflineSessionOpenDate } from './night-audit-guard';

describe('reconcileOfflineSessionOpenDate', () => {
  it('corrects a stale cached date when the session was opened on the current property date', () => {
    const result = reconcileOfflineSessionOpenDate({
      propertyBusinessDate: new Date('2026-11-28T00:00:00.000Z'),
      sessionBusinessDate: new Date('2026-11-27T00:00:00.000Z'),
      occurredAt: new Date('2026-11-28T10:43:02.000Z'),
      timezone: 'Africa/Lagos',
    });

    expect(result).toEqual({
      businessDate: new Date('2026-11-28T00:00:00.000Z'),
      corrected: true,
    });
  });

  it('keeps a valid session date unchanged', () => {
    const result = reconcileOfflineSessionOpenDate({
      propertyBusinessDate: new Date('2026-11-28T00:00:00.000Z'),
      sessionBusinessDate: new Date('2026-11-28T00:00:00.000Z'),
      occurredAt: new Date('2026-11-28T10:43:02.000Z'),
      timezone: 'Africa/Lagos',
    });

    expect(result).toEqual({
      businessDate: new Date('2026-11-28T00:00:00.000Z'),
      corrected: false,
    });
  });

  it('does not silently create a historical shift several days after its date', () => {
    expect(() => reconcileOfflineSessionOpenDate({
      propertyBusinessDate: new Date('2026-11-30T00:00:00.000Z'),
      sessionBusinessDate: new Date('2026-11-27T00:00:00.000Z'),
      occurredAt: new Date('2026-11-28T10:43:02.000Z'),
      timezone: 'Africa/Lagos',
    })).toThrow('NIGHT_AUDIT_REQUIRED');
  });

  it('does not correct a session that is more than one day stale', () => {
    expect(() => reconcileOfflineSessionOpenDate({
      propertyBusinessDate: new Date('2026-11-28T00:00:00.000Z'),
      sessionBusinessDate: new Date('2026-11-26T00:00:00.000Z'),
      occurredAt: new Date('2026-11-28T10:43:02.000Z'),
      timezone: 'Africa/Lagos',
    })).toThrow('NIGHT_AUDIT_REQUIRED');
  });

  it('rejects a session date ahead of the cloud property date', () => {
    expect(() => reconcileOfflineSessionOpenDate({
      propertyBusinessDate: new Date('2026-11-28T00:00:00.000Z'),
      sessionBusinessDate: new Date('2026-11-29T00:00:00.000Z'),
      occurredAt: new Date('2026-11-28T10:43:02.000Z'),
      timezone: 'Africa/Lagos',
    })).toThrow('ahead of the property date');
  });
});
