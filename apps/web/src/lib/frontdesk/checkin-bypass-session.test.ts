import { describe, expect, it, vi } from 'vitest';
import { findCheckInBypassSession } from './checkin-bypass-session';

const businessDate = new Date('2026-11-08T00:00:00.000Z');

function dbWith(findFirst: ReturnType<typeof vi.fn>) {
  return { frontdeskSession: { findFirst } } as any;
}

describe('findCheckInBypassSession', () => {
  it('uses an open session before considering recovery', async () => {
    const findFirst = vi.fn()
      .mockResolvedValueOnce({ id: 'open-session', status: 'OPEN' });

    const result = await findCheckInBypassSession(dbWith(findFirst), 'property', 'staff', businessDate);

    expect(result).toEqual({ session: { id: 'open-session', status: 'OPEN' }, recovery: false });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it('recovers only the operator same-day submitted shift', async () => {
    const findFirst = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'closed-session', status: 'CLOSED', controlStatus: 'SUBMITTED' });

    const result = await findCheckInBypassSession(dbWith(findFirst), 'property', 'staff', businessDate);

    expect(result).toEqual({ session: { id: 'closed-session', status: 'CLOSED', controlStatus: 'SUBMITTED' }, recovery: true });
    expect(findFirst.mock.calls[1][0].where).toMatchObject({
      propertyId: 'property',
      staffId: 'staff',
      businessDate,
      status: 'CLOSED',
      controlStatus: { in: ['SUBMITTED', 'UNDER_REVIEW', 'RETURNED'] },
    });
  });

  it('does not search closed shifts when the business date is unavailable', async () => {
    const findFirst = vi.fn().mockResolvedValueOnce(null);

    const result = await findCheckInBypassSession(dbWith(findFirst), 'property', 'staff');

    expect(result).toEqual({ session: null, recovery: false });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
