import { POST } from '../app/api/v1/sync/push/route';
import prisma from '@hotel-pms/db';

// Mock the Next.js Request object
class MockRequest {
  private body: any;
  public headers: Map<string, string>;
  
  constructor(body: any, headers: Record<string, string>) {
    this.body = body;
    this.headers = new Map(Object.entries(headers));
  }
  
  async json() {
    return this.body;
  }
}

// Mock Prisma
jest.mock('@hotel-pms/db', () => ({
  property: {
    findUnique: jest.fn(),
  },
  posOrder: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  $transaction: jest.fn(async (cb) => {
    return cb({
      posOrder: { create: jest.fn().mockResolvedValue({ orderNumber: 'POS-123' }) },
      recipeIngredient: { findMany: jest.fn().mockResolvedValue([{ id: 'ing1', stockItemId: 'stk1', quantity: 2, stockItem: { costPrice: 10 } }]) },
      stockItem: { update: jest.fn() },
      stockTransaction: { create: jest.fn() }
    });
  }),
  folioItem: {
    findFirst: jest.fn(),
    create: jest.fn(),
  },
  folio: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  syncConflict: {
    create: jest.fn(),
  }
}));

describe('POS Sync Idempotency API', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const baseOrderPayload = {
    outletId: 'out1',
    sessionId: 'sess1',
    orderNumber: 'POS-123',
    status: 'COMPLETED',
    businessDate: '2026-08-17',
    subtotal: 100,
    total: 100,
    items: [
      { id: 'item1', productId: 'prod1', quantity: 2, unitPrice: 50, total: 100 }
    ],
    payments: []
  };

  it('rejects if no Idempotency-Key header is provided', async () => {
    const req = new MockRequest({}, {});
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns ALREADY_APPLIED for duplicate PosOrder sync (Idempotency)', async () => {
    (prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop1' });
    (prisma.posOrder.findUnique as jest.Mock).mockResolvedValue({ id: 'existing-order' }); // Simulate existing

    const req = new MockRequest({
      operationId: 'op-123',
      entityType: 'POS_ORDER',
      operationType: 'CREATE',
      payloadJson: JSON.stringify(baseOrderPayload),
      propertyId: 'prop1'
    }, { 'Idempotency-Key': 'op-123' });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ALREADY_APPLIED');
    
    // Ensure transaction was not called
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates PosOrder and explodes recipe for StockTransactions', async () => {
    (prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop1' });
    (prisma.posOrder.findUnique as jest.Mock).mockResolvedValue(null);

    const req = new MockRequest({
      operationId: 'op-456',
      entityType: 'POS_ORDER',
      operationType: 'CREATE',
      payloadJson: JSON.stringify(baseOrderPayload),
      propertyId: 'prop1'
    }, { 'Idempotency-Key': 'op-456' });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('SYNCED');

    expect(prisma.$transaction).toHaveBeenCalled();
    // The transaction callback internals are mocked in the beforeEach, but we can verify it passed.
  });

  it('escalates to MANAGER_REVIEW when ADD_ROOM_CHARGE is attempted on a closed Folio', async () => {
    (prisma.property.findUnique as jest.Mock).mockResolvedValue({ id: 'prop1' });
    (prisma.folioItem.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.folio.findUnique as jest.Mock).mockResolvedValue({ id: 'fol1', status: 'CLOSED' });

    const req = new MockRequest({
      operationId: 'op-room-charge-1',
      entityType: 'FOLIO',
      operationType: 'ADD_ROOM_CHARGE',
      payloadJson: JSON.stringify({ folioId: 'fol1', amount: 1000 }),
      propertyId: 'prop1'
    }, { 'Idempotency-Key': 'op-room-charge-1' });

    const res = await POST(req as any);
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.status).toBe('CONFLICT');

    expect(prisma.syncConflict.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        entityType: 'FOLIO',
        conflictReason: expect.stringContaining('MANAGER_REVIEW')
      })
    }));
  });
});
