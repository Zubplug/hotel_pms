import { beforeEach, describe, expect, it, vi } from 'vitest';

const transaction = vi.fn();

vi.mock('@hotel-pms/db', () => ({
  default: { $transaction: transaction },
  FrontdeskSessionStatus: { OPEN: 'OPEN', CLOSED: 'CLOSED' },
  PosSessionStatus: { OPEN: 'OPEN', CLOSED: 'CLOSED' },
}));

import { ShiftControlService } from './shift-control-service';

describe('ShiftControlService.returnShift', () => {
  beforeEach(() => transaction.mockReset());

  it('reopens a returned front-desk shift for normal operations', async () => {
    const update = vi.fn().mockResolvedValue({ id: 'shift-1', status: 'OPEN', controlStatus: 'OPEN' });
    const tx = {
      frontdeskSession: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'shift-1',
          propertyId: 'property-1',
          staffId: 'operator-1',
          controlStatus: 'SUBMITTED',
        }),
        update,
      },
      shiftControlAudit: { create: vi.fn() },
    };
    transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) => callback(tx));

    await ShiftControlService.returnShift(
      { propertyIds: ['property-1'], userId: 'manager-1' } as any,
      'FRONT_DESK',
      'shift-1',
      'Pending offline check-in and keycard work must be completed.',
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: 'shift-1' },
      data: expect.objectContaining({
        status: 'OPEN',
        controlStatus: 'OPEN',
        approvalDecision: 'REJECTED',
        closedAt: null,
        submittedAt: null,
        submittedBy: null,
        approvedBy: null,
        approvedAt: null,
      }),
    });
    expect(tx.shiftControlAudit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'SHIFT_RETURNED',
        fromStatus: 'SUBMITTED',
        toStatus: 'OPEN',
        metadata: expect.objectContaining({ reopenedForOperationalCorrection: true }),
      }),
    });
  });
});
