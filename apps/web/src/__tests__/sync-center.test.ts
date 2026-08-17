import { POST } from '../app/api/v1/sync/conflicts/[id]/resolve/route';
import prisma from '@hotel-pms/db';

// Mock Next.js Request
class MockRequest {
  private body: any;
  
  constructor(body: any) {
    this.body = body;
  }
  
  async json() {
    return this.body;
  }
}

jest.mock('@hotel-pms/db', () => ({
  syncConflict: {
    findUnique: jest.fn(),
    update: jest.fn(),
  },
  folio: {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  folioItem: {
    create: jest.fn(),
  },
  $transaction: jest.fn(async (cb) => {
    return cb({
      folio: {
        findUnique: jest.fn().mockResolvedValue({ id: 'old-folio', currency: 'NGN' }),
        create: jest.fn().mockResolvedValue({ id: 'new-city-ledger-folio', folioNumber: 'CL-123', currency: 'NGN' }),
        update: jest.fn()
      },
      folioItem: { create: jest.fn() },
      syncConflict: { update: jest.fn() }
    });
  })
}));

describe('Sync Conflict Resolution API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('resolves a conflict by posting to City Ledger', async () => {
    const mockConflict = {
      id: 'conflict-1',
      status: 'PENDING',
      operationId: 'op123456789',
      propertyId: 'prop-1',
      entityId: 'old-folio',
      payload: JSON.stringify({ amount: 1000, description: 'Room Charge' })
    };

    (prisma.syncConflict.findUnique as jest.Mock).mockResolvedValue(mockConflict);
    (prisma.userRole.findFirst as jest.Mock).mockResolvedValue({ role: { name: 'MANAGER' } });

    const req = new MockRequest({ action: 'CITY_LEDGER', userId: 'manager-1' });
    const res = await POST(req as any, { params: { id: 'conflict-1' } });

    expect(res.status).toBe(200);
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  it('rejects unauthorized users (non-managers)', async () => {
    (prisma.syncConflict.findUnique as jest.Mock).mockResolvedValue({ status: 'PENDING', propertyId: 'prop-1' });
    (prisma.userRole.findFirst as jest.Mock).mockResolvedValue(null); // No manager role found

    const req = new MockRequest({ action: 'CITY_LEDGER', userId: 'receptionist-1' });
    const res = await POST(req as any, { params: { id: 'conflict-1' } });

    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/Unauthorized/);
  });

  it('provides financial idempotency for City Ledger postings', async () => {
    const mockConflict = {
      id: 'conflict-1',
      status: 'PENDING',
      operationId: 'op123456789',
      propertyId: 'prop-1',
      entityId: 'old-folio',
      payload: JSON.stringify({ amount: 1000, description: 'Room Charge' })
    };

    (prisma.syncConflict.findUnique as jest.Mock).mockResolvedValue(mockConflict);
    (prisma.userRole.findFirst as jest.Mock).mockResolvedValue({ role: { name: 'MANAGER' } });
    
    // Override the transaction mock to simulate an existing folioItem
    (prisma.$transaction as jest.Mock).mockImplementationOnce(async (cb) => {
      return cb({
        folioItem: { findFirst: jest.fn().mockResolvedValue({ id: 'existing-charge' }) } // simulate existing
      });
    });

    const req = new MockRequest({ action: 'CITY_LEDGER', userId: 'manager-1' });
    const res = await POST(req as any, { params: { id: 'conflict-1' } });

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ALREADY_APPLIED');
  });

  it('rejects if conflict is already resolved', async () => {
    (prisma.syncConflict.findUnique as jest.Mock).mockResolvedValue({ status: 'RESOLVED' });

    const req = new MockRequest({ action: 'REJECT', userId: 'manager-1' });
    const res = await POST(req as any, { params: { id: 'conflict-2' } });

    expect(res.status).toBe(400);
  });
});
