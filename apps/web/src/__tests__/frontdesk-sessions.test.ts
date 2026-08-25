import { POST as OpenSession } from '../app/api/v1/frontdesk/sessions/route';
import { POST as CloseSession } from '../app/api/v1/frontdesk/sessions/[id]/close/route';
import prisma from '@hotel-pms/db';

jest.mock('@/lib/auth', () => ({
  auth: jest.fn().mockResolvedValue({ user: { id: 'test-user-id' } })
}));

class MockRequest {
  private body: any;
  public url: string;
  
  constructor(body: any, url: string = 'http://localhost/api/v1/frontdesk/sessions') {
    this.body = body;
    this.url = url;
  }
  
  async json() {
    return this.body;
  }
}

describe('Frontdesk Sessions', () => {
  let propertyId = '';
  let staffId = '';
  let cashAccountId = '';

  beforeAll(async () => {
    // Setup test data
    const prop = await prisma.property.create({
      data: {
        name: 'Test Hotel',
        businessDate: new Date('2026-08-25T00:00:00.000Z'),
        timezone: 'Africa/Lagos'
      }
    });
    propertyId = prop.id;

    const user = await prisma.user.create({
      data: {
        id: 'test-user-id',
        email: 'test@hotel.com',
        name: 'Test User',
      }
    });

    const staff = await prisma.staff.create({
      data: {
        userId: 'test-user-id',
        firstName: 'Test',
        lastName: 'User',
        employeeId: 'EMP1',
      }
    });
    staffId = staff.id;

    const acc = await prisma.cashAccount.create({
      data: {
        propertyId,
        name: 'Main Till',
        type: 'STATION_BANK'
      }
    });
    cashAccountId = acc.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.reconciliationException.deleteMany({});
    await prisma.frontdeskSessionAudit.deleteMany({});
    await prisma.posCashMovement.deleteMany({});
    await prisma.frontdeskSession.deleteMany({});
    await prisma.cashAccount.deleteMany({});
    await prisma.staff.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.property.deleteMany({});
  });

  it('should open a shift and enforce concurrency constraints', async () => {
    const req1 = new MockRequest({
      propertyId,
      cashAccountId,
      openingFloat: 50000
    }) as any;

    const res1 = await OpenSession(req1);
    const data1 = await res1.json();
    expect(res1.status).toBe(200);
    expect(data1.session.status).toBe('OPEN');
    expect(data1.session.systemExpectedCash).toBe('50000');

    // Attempt to open another shift with the same staff
    const res2 = await OpenSession(req1);
    const data2 = await res2.json();
    expect(res2.status).toBe(409);
    expect(data2.error).toContain('Staff already has an open session');
  });

  it('should close a shift and calculate variance', async () => {
    const session = await prisma.frontdeskSession.findFirst({ where: { staffId, status: 'OPEN' } });
    
    // Simulate some cash movements (Payment)
    await prisma.posCashMovement.create({
      data: {
        propertyId,
        deviceId: 'SYSTEM',
        userId: staffId,
        amount: 25000,
        currency: 'NGN',
        type: 'PAYMENT',
        sourceAccountId: cashAccountId,
        destinationAccountId: cashAccountId,
        reasonCode: 'CASH_PAYMENT',
        operationId: `PAY-TEST-${Date.now()}`,
        frontdeskSessionId: session!.id,
      }
    });

    // Expected is now 50000 (float) + 25000 (payment) = 75000
    // Let's declare 70000 (Short by 5000)
    const req = new MockRequest({
      declaredCash: 70000
    }) as any;

    const res = await CloseSession(req, { params: { id: session!.id } });
    const data = await res.json();
    
    expect(res.status).toBe(200);
    expect(data.session.status).toBe('CLOSED');
    expect(data.session.systemExpectedCash).toBe('75000');
    expect(data.session.declaredCash).toBe('70000');
    expect(data.session.variance).toBe('-5000');

    // Verify exception was generated
    const exceptions = await prisma.reconciliationException.findMany({ where: { frontdeskSessionId: session!.id } });
    expect(exceptions.length).toBe(1);
    expect(exceptions[0].amount?.toString()).toBe('5000');
    expect(exceptions[0].reason).toBe('CASH_SHORT');
  });
});
