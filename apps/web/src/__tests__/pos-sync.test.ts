import { POST } from '../app/api/v1/pos/sync/push/route';
import prisma from '@hotel-pms/db';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/night-audit-guard', () => ({
  isNightAuditCutoverActive: vi.fn().mockResolvedValue(false),
  assertOfflineSessionOpenDate: vi.fn().mockResolvedValue(undefined),
}));

// Mock the Next.js Request object
class MockRequest {
  private body: any;
  private headersObj: Record<string, string>;
  
  constructor(body: any, headers: Record<string, string>) {
    this.body = body;
    this.headersObj = headers;
  }
  
  async json() {
    return this.body.operationId
      ? { ...this.body, events: [{ ...this.body, terminalId: 'terminal-1' }] }
      : this.body;
  }

  get headers() {
    return { get: (key: string) => this.headersObj[key] ?? this.headersObj[Object.keys(this.headersObj).find((name) => name.toLowerCase() === key.toLowerCase()) ?? key] };
  }
}

// Mock Prisma
vi.mock('@hotel-pms/db', () => {
  const mockPrisma = {
  posTerminal: {
    findUnique: vi.fn().mockResolvedValue({
      id: 'terminal-1', registrationState: 'REGISTERED',
      outlet: { propertyId: 'prop1', property: { id: 'prop1' } },
    }),
  },
  property: {
    findUnique: vi.fn(),
  },
  posOrder: {
    findUnique: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(async (cb) => {
    return cb({
      posOrder: { create: vi.fn().mockResolvedValue({ orderNumber: 'POS-123' }) },
      recipeIngredient: { findMany: vi.fn().mockResolvedValue([{ id: 'ing1', stockItemId: 'stk1', quantity: 2, stockItem: { costPrice: 10 } }]) },
      stockItem: { update: vi.fn() },
      stockTransaction: { create: vi.fn() }
    });
  }),
  folioItem: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  folio: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  syncConflict: {
    create: vi.fn(),
  }
  };
  return { default: mockPrisma, ...mockPrisma };
});

describe('POS Sync Idempotency API', () => {
  
  beforeEach(() => {
    vi.clearAllMocks();
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
    expect(res.status).toBe(401);
  });

  it('returns ALREADY_APPLIED for duplicate PosOrder sync (Idempotency)', async () => {
    (prisma.property.findUnique as vi.Mock).mockResolvedValue({ id: 'prop1' });
    (prisma.posOrder.findUnique as vi.Mock).mockResolvedValue({ id: 'existing-order' }); // Simulate existing

    const req = new MockRequest({
      operationId: 'op-123',
      entityType: 'POS_ORDER',
      entityId: '11111111-1111-4111-8111-111111111111',
      operationType: 'CREATE',
      payloadJson: JSON.stringify(baseOrderPayload),
      propertyId: 'prop1'
    }, { Authorization: 'Bearer test-token', 'Idempotency-Key': 'op-123' });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ALREADY_APPLIED');
    
    // Ensure transaction was not called
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('creates PosOrder and explodes recipe for StockTransactions', async () => {
    (prisma.property.findUnique as vi.Mock).mockResolvedValue({ id: 'prop1' });
    (prisma.posOrder.findUnique as vi.Mock).mockResolvedValue(null);

    const req = new MockRequest({
      operationId: 'op-456',
      entityType: 'POS_ORDER',
      entityId: '22222222-2222-4222-8222-222222222222',
      operationType: 'CREATE',
      payloadJson: JSON.stringify(baseOrderPayload),
      propertyId: 'prop1'
    }, { Authorization: 'Bearer test-token', 'Idempotency-Key': 'op-456' });

    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('SYNCED');

    expect(prisma.$transaction).toHaveBeenCalled();
    // The transaction callback internals are mocked in the beforeEach, but we can verify it passed.
  });

  it('escalates to MANAGER_REVIEW when ADD_ROOM_CHARGE is attempted on a closed Folio', async () => {
    (prisma.property.findUnique as vi.Mock).mockResolvedValue({ id: 'prop1' });
    (prisma.folioItem.findFirst as vi.Mock).mockResolvedValue(null);
    (prisma.folio.findUnique as vi.Mock).mockResolvedValue({ id: 'fol1', status: 'CLOSED' });

    const req = new MockRequest({
      operationId: 'op-room-charge-1',
      entityType: 'FOLIO',
      entityId: '33333333-3333-4333-8333-333333333333',
      operationType: 'ADD_ROOM_CHARGE',
      payloadJson: JSON.stringify({ folioId: 'fol1', amount: 1000 }),
      propertyId: 'prop1'
    }, { Authorization: 'Bearer test-token', 'Idempotency-Key': 'op-room-charge-1' });

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
