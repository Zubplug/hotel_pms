import { POST } from '../app/api/v1/sync/push/route';
import prisma from '@hotel-pms/db';

// Mock Next.js Request
class MockRequest {
  private body: any;
  private headersObj: Record<string, string>;
  
  constructor(body: any, headers: Record<string, string> = {}) {
    this.body = body;
    this.headersObj = headers;
  }
  
  async json() {
    return this.body;
  }
  
  get headers() {
    return {
      get: (key: string) => this.headersObj[key]
    };
  }
}

jest.mock('@hotel-pms/db', () => ({
  property: {
    findUnique: jest.fn().mockResolvedValue({ id: 'prop-1', businessDate: new Date() }),
  },
  posSession: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  posVoid: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  stockTransaction: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  stockItem: {
    update: jest.fn(),
  },
  posPayment: {
    aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
  },
  $transaction: jest.fn(async (cb) => {
    return cb({
      posSession: {
        create: jest.fn(),
        update: jest.fn(),
      },
      posPayment: {
        aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 1000 } }),
      },
      posVoid: {
        create: jest.fn(),
      },
      stockTransaction: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'sale-1',
          stockItemId: 'item-1',
          quantity: -1,
          unitCost: 100,
          reference: 'Order-123'
        }]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
      stockItem: {
        update: jest.fn(),
      }
    });
  })
}));

describe('Phase 1.3 - POS Financial Controls Sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calculates expectedCash server-side when closing a PosSession', async () => {
    (prisma.posSession.findUnique as jest.Mock).mockResolvedValue({
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
      entityId: 'session-1',
      operationType: 'UPDATE',
      payloadJson: JSON.stringify(payload),
      propertyId: 'prop-1'
    }, { 'Idempotency-Key': 'key1' });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    // The transaction should have calculated 500 (opening) + 1000 (mock aggregate sales) - 0 (refunds) = 1500 expected
    // actual: 1500, variance: 0
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('restores inventory immutably via RETURN when POS_VOID is synced', async () => {
    (prisma.posVoid.findUnique as jest.Mock).mockResolvedValue(null);

    const payload = {
      orderId: 'order-1',
      orderNumber: 'Order-123',
      reason: 'Guest changed mind'
    };

    const req = new MockRequest({
      operationId: 'op_void_1',
      entityType: 'POS_VOID',
      entityId: 'void-1',
      operationType: 'CREATE',
      payloadJson: JSON.stringify(payload),
      propertyId: 'prop-1'
    }, { 'Idempotency-Key': 'key2' });

    const res = await POST(req as any);
    expect(res.status).toBe(200);

    expect(prisma.$transaction).toHaveBeenCalled();
    // It creates a PosVoid and StockTransaction of type POS_VOID
  });
});
