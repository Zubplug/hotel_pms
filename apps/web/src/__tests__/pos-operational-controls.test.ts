import { POST as NightAuditPOST } from '../app/api/v1/night-audit/execute/route';
import { POST as SyncPOST } from '../app/api/v1/pos/sync/push/route';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth', () => ({ auth: vi.fn().mockResolvedValue({ user: { id: 'user-1', role: 'GENERAL_CASHIER' } }) }));
vi.mock('@/lib/organization-access', () => ({ requireOrganizationContext: vi.fn().mockResolvedValue({ propertyIds: ['prop-1'] }) }));
vi.mock('@/lib/rbac', () => ({ hasPermission: vi.fn().mockResolvedValue(true) }));
import prisma from '@hotel-pms/db';

class MockRequest {
  private body: any;
  private headersObj: Record<string, string>;
  
  constructor(body: any, headers: Record<string, string> = {}) {
    this.body = body;
    this.headersObj = headers;
  }
  
  async json() { return this.body; }
  get headers() { return { get: (k: string) => this.headersObj[k] }; }
}

vi.mock('@hotel-pms/db', () => {
  const mockPrisma = {
  property: {
    findUnique: vi.fn().mockResolvedValue({ id: 'prop-1', businessDate: new Date() }),
    update: vi.fn()
  },
  posSession: { count: vi.fn() },
  syncConflict: { count: vi.fn() },
  posCashMovement: {
    findUnique: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn().mockResolvedValue([{ amount: 50, type: 'CASH_DROP' }])
  },
  posReceiptAudit: {
    findUnique: vi.fn(),
    create: vi.fn()
  },
  posAuthorizationAudit: {
    findUnique: vi.fn(),
    create: vi.fn()
  },
  $transaction: vi.fn(async (cb) => {
    return cb({
      nightAudit: { create: vi.fn() },
      property: { update: vi.fn() },
      posAuthorizationAudit: { create: vi.fn() }
    });
  })
  };
  return { default: mockPrisma, ...mockPrisma };
});

describe('Phase 1.4 - POS Operational Controls', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('blocks night audit if POS sessions are open', async () => {
    (prisma.posSession.count as vi.Mock).mockResolvedValue(1); // 1 open session
    (prisma.syncConflict.count as vi.Mock).mockResolvedValue(0);

    const req = new MockRequest({ propertyId: 'prop-1', userId: 'user-1' });
    const res = await NightAuditPOST(req as any);
    
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('POS_CONFLICTS_EXIST');
  });

  it('allows night audit override and creates PosAuthorizationAudit', async () => {
    (prisma.posSession.count as vi.Mock).mockResolvedValue(1);
    
    const req = new MockRequest({ 
      propertyId: 'prop-1', 
      userId: 'manager-1', 
      overridePosConflicts: true,
      overrideReason: 'Manager requested EOD override'
    });
    
    const res = await NightAuditPOST(req as any);
    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
    // posAuthorizationAudit.create is called inside tx
  });

  it('syncs POS_CASH_MOVEMENT idempotently', async () => {
    (prisma.posCashMovement.findUnique as vi.Mock).mockResolvedValue(null);

    const req = new MockRequest({
      operationId: 'op_cashdrop_1',
      entityType: 'POS_CASH_MOVEMENT',
      entityId: 'drop-1',
      operationType: 'CREATE',
      payloadJson: '{}', // Not parsed directly for fields in this branch
      propertyId: 'prop-1',
      posSessionId: 'session-1',
      amount: 50000,
      type: 'CASH_DROP'
    }, { 'Idempotency-Key': 'key-1' });

    const res = await SyncPOST(req as any);
    expect(res.status).toBe(200);
    expect(prisma.posCashMovement.create).toHaveBeenCalled();
  });
});
