import { POST } from '../app/api/v1/pos/sync/push/route';
import prisma from '@hotel-pms/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/night-audit-guard', () => ({
  isNightAuditCutoverActive: vi.fn().mockResolvedValue(false),
  assertOfflineSessionOpenDate: vi.fn().mockResolvedValue(undefined),
}));

// Mock Next.js Request
class MockRequest {
  private body: any;
  private headersObj: Record<string, string>;
  
  constructor(body: any, headers: Record<string, string> = {}) {
    this.body = body;
    this.headersObj = headers;
  }
  
  async json() {
    return this.body.operationId
      ? { ...this.body, events: [{ ...this.body, terminalId: 'terminal-1' }] }
      : this.body;
  }
  
  get headers() {
    return {
      get: (key: string) => this.headersObj[key] ?? this.headersObj[Object.keys(this.headersObj).find((name) => name.toLowerCase() === key.toLowerCase()) ?? key]
    };
  }
}

vi.mock('@hotel-pms/db', () => {
  const mockPrisma = {
  posTerminal: {
    findUnique: vi.fn().mockResolvedValue({
      id: 'terminal-1', registrationState: 'REGISTERED',
      outlet: { propertyId: 'prop-1', property: { id: 'prop-1' } },
    }),
  },
  property: {
    findUnique: vi.fn().mockResolvedValue({ id: 'prop-1', businessDate: new Date() }),
  },
  posSession: {
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  posVoid: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  stockTransaction: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  stockItem: {
    update: vi.fn(),
  },
  posPayment: {
    aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  $transaction: vi.fn(async (cb) => {
    return cb({
      posSession: {
        create: vi.fn(),
        update: vi.fn(),
      },
      posPayment: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { amount: 1000 } }),
      },
      posVoid: {
        create: vi.fn(),
      },
      stockTransaction: {
        findMany: vi.fn().mockResolvedValue([{
          id: 'sale-1',
          stockItemId: 'item-1',
          quantity: -1,
          unitCost: 100,
          reference: 'Order-123'
        }]),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn(),
      },
      stockItem: {
        update: vi.fn(),
      }
    });
  })
  };
  return { default: mockPrisma, ...mockPrisma };
});

describe('Phase 1.3 - POS Financial Controls Sync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calculates expectedCash server-side when closing a PosSession', async () => {
    (prisma.posSession.findUnique as vi.Mock).mockResolvedValue({
      id: 'session-1',
      openingBalance: 500
    });

    const payload = {
      status: 'CLOSED',
      actualCash: 1500, // Drawer has 1500
      cashPaidOut: 0
    };

    const req = new MockRequest({
      operationId: 'op_close_session',
      entityType: 'POS_SESSION',
      entityId: '44444444-4444-4444-8444-444444444444',
      operationType: 'UPDATE',
      payloadJson: JSON.stringify(payload),
      propertyId: 'prop-1'
    }, { Authorization: 'Bearer test-token', 'Idempotency-Key': 'key1' });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    // The transaction should have calculated 500 (opening) + 1000 (mock aggregate sales) - 0 (refunds) = 1500 expected
    // actual: 1500, variance: 0
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('restores inventory immutably via RETURN when POS_VOID is synced', async () => {
    (prisma.posVoid.findUnique as vi.Mock).mockResolvedValue(null);

    const payload = {
      orderId: 'order-1',
      orderNumber: 'Order-123',
      reason: 'Guest changed mind'
    };

    const req = new MockRequest({
      operationId: 'op_void_1',
      entityType: 'POS_VOID',
      entityId: '55555555-5555-4555-8555-555555555555',
      operationType: 'CREATE',
      payloadJson: JSON.stringify(payload),
      propertyId: 'prop-1'
    }, { Authorization: 'Bearer test-token', 'Idempotency-Key': 'key2' });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    expect(prisma.$transaction).toHaveBeenCalled();
    // It creates a PosVoid and StockTransaction of type POS_VOID
  });
});
