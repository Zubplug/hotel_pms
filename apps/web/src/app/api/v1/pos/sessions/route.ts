import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    let staffId: string | null = null;
    let propertyId: string | null = null;
    let loggedInUserId: string | null = null;
    let isManager = false;

    if (token) {
      const payload = await verifyOperatorToken(token);
      if (!payload) return NextResponse.json({ error: 'Invalid operator token' }, { status: 401 });
      staffId = payload.staffId;
      propertyId = payload.propertyId;
      loggedInUserId = payload.staffId; // Since Waiters don't always have a User account, we use their staffId as openedBy
    } else {
      const session = await auth();
      if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      staffId = session.user.staffId || null;
      propertyId = (session.user as any).propertyId;
      loggedInUserId = session.user.id;
      isManager = session.user.role === 'SUPER_ADMIN' || session.user.role === 'HOTEL_MANAGER';
      if (!staffId && !isManager) return NextResponse.json({ error: 'Forbidden: No staff profile linked' }, { status: 403 });
    }

    const data = await req.json();
    propertyId = propertyId || data.propertyId;
    const { deviceId, outletId, openingCash } = data;

    if (!propertyId || !deviceId || !outletId) {
      return NextResponse.json({ error: 'Missing required fields: propertyId, deviceId, outletId' }, { status: 400 });
    }

    // 1. Verify Device is ACTIVE and belongs to Property
    const device = await prisma.posDevice.findUnique({
      where: { identifier: deviceId }
    });

    if (!device) return NextResponse.json({ error: 'Device not found' }, { status: 404 });
    if (device.propertyId !== propertyId || device.status !== 'ACTIVE') {
      return NextResponse.json({ error: `Device is invalid or not active (Status: ${device?.status})` }, { status: 403 });
    }

    // 2. Validate Device-Outlet binding
    if (device.outletId && device.outletId !== outletId) {
      return NextResponse.json({ error: 'This device is physically bound to a different outlet' }, { status: 403 });
    }

    // 3. Verify Outlet exists
    const outlet = await prisma.posOutlet.findUnique({
      where: { id: outletId }
    });

    if (!outlet || outlet.propertyId !== propertyId || !outlet.isActive) {
      return NextResponse.json({ error: 'Outlet is invalid or inactive' }, { status: 400 });
    }

    // 4. Verify Staff has access to Outlet
    if (!isManager) {
      const access = await prisma.staffPosOutletAccess.findUnique({
        where: { staffId_outletId: { staffId: staffId as string, outletId: outlet.id } }
      });
      if (!access) return NextResponse.json({ error: 'You are not authorized to open a session at this outlet' }, { status: 403 });
    }
    
    // 5. Fetch Property settings for banking model
    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    if (!property || !property.isActive) {
      return NextResponse.json({ error: 'Property not found or inactive' }, { status: 400 });
    }
    const bankingModel = (property?.settings as any)?.pos?.bankingModel || 'CENTRAL_CASHIER';
    const bankType = bankingModel === 'SERVER_BANKING' ? 'SERVER' : 'CENTRAL';

    // General Cashier is a separate receiving/review role. A central POS
    // bank is opened by a POS cashier (or authorized manager), while every
    // server subsequently attaches to that same bank.
    const staffProfile = staffId
      ? await prisma.staff.findUnique({ where: { id: staffId }, select: { position: true, department: true } })
      : null;
    const staffRoleText = `${staffProfile?.position ?? ''} ${staffProfile?.department ?? ''}`
      .toLowerCase()
      .replace(/[^a-z]/g, '');
    const isGeneralCashier = staffRoleText.includes('generalcashier') || staffRoleText.includes('centralcashier');
    if (bankingModel === 'CENTRAL_CASHIER' && isGeneralCashier && !isManager) {
      return NextResponse.json({ error: 'General Cashier cannot open the POS bank. A POS cashier must open it.' }, { status: 403 });
    }

    // 6. Transaction to check for existing OPEN session and create new
    const result = await prisma.$transaction(async (tx: any) => {
      if (bankingModel === 'SERVER_BANKING') {
        const existingBank = await tx.posSession.findFirst({
          where: { propertyId, outletId, primaryOperatorId: staffId, status: 'OPEN', controlStatus: 'OPEN', bankType: 'SERVER' }
        });
        if (existingBank) return existingBank; // Idempotent logic per Waiter
      } else {
        const existingSession = await tx.posSession.findFirst({
          where: {
            propertyId,
            outletId: outlet.id,
            status: 'OPEN',
            controlStatus: 'OPEN',
            bankType: 'CENTRAL',
            bankingModel: 'CENTRAL_CASHIER'
          },
          orderBy: { openedAt: 'desc' }
        });
        if (existingSession) {
          return existingSession;
        }

        if (bankingModel === 'CENTRAL_CASHIER' && !isManager) {
          throw new Error('No central POS bank is open. A POS cashier must open it before servers can log in.');
        }
      }

      return tx.posSession.create({
        data: {
          propertyId,
          outletId: outlet.id,
          deviceId: device.id, // Satisfy DB NOT NULL constraint; servers can still roam
          businessDate: new Date(),
          openingCash: openingCash || 0,
          expectedCash: openingCash || 0,
          openedBy: loggedInUserId,
          primaryOperatorId: staffId,
          bankingModel,
          bankType,
          status: 'OPEN'
        }
      });
    });

    return NextResponse.json({ data: { sessionId: result.id } });

  } catch (error: any) {
    console.error('Error starting POS session:', error);
    // If it's our transaction throw
    if (error.message.includes('already has an OPEN')) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
