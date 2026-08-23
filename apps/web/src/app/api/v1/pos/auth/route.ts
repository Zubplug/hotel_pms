import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';
import { auth } from '@/lib/auth';
import { SignJWT } from 'jose';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { staffId, pin, propertyId } = body;
    const sessionId = body.sessionId || undefined;
    let outletId = body.outletId || undefined;
    const clientDeviceIdentifier = body.deviceId || undefined;
    let dbDeviceId: string | undefined = undefined;

    if (clientDeviceIdentifier) {
      // The frontend passes the device identifier string (e.g. dev_123). We must resolve it to the true UUID.
      const device = await prisma.posDevice.findUnique({
        where: { identifier: clientDeviceIdentifier }
      });
      if (device) {
        dbDeviceId = device.id;
        if (!outletId && device.outletId) {
          outletId = device.outletId;
        }
      }
    }

    if (!staffId || !pin) {
      return NextResponse.json({ error: 'Missing required fields: staffId, pin' }, { status: 400 });
    }

    const staff = await prisma.staff.findUnique({
      where: { id: staffId }
    });

    if (!staff || !staff.isActive) {
      return NextResponse.json({ error: 'Staff member not found or inactive' }, { status: 404 });
    }

    if (!staff.posPinHash) {
      return NextResponse.json({ error: 'Staff member does not have a POS PIN configured' }, { status: 403 });
    }

    const isValid = await compare(pin, staff.posPinHash);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid PIN' }, { status: 401 });
    }

    // Generate operator JWT
    const jwtSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
    if (!jwtSecret) throw new Error('NEXTAUTH_SECRET missing');
    const secret = new TextEncoder().encode(jwtSecret);

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });
    const bankingModel = (property?.settings as any)?.pos?.bankingModel || 'CENTRAL_CASHIER';
    const bankType = bankingModel === 'SERVER_BANKING' ? 'SERVER' : 'CENTRAL';

    let activeSessionId = sessionId || null;
    let requiresBank = false;
    let bankOwner = null;

    if (bankingModel === 'SERVER_BANKING') {
      const openSession = await prisma.posSession.findFirst({
        where: { propertyId, outletId, primaryOperatorId: staff.id, status: 'OPEN', bankType: 'SERVER' },
        orderBy: { openedAt: 'desc' }
      });
      if (openSession) {
        activeSessionId = openSession.id;
      } else if (dbDeviceId && outletId) {
        const newSession = await prisma.posSession.create({
          data: {
            propertyId,
            outletId,
            deviceId: dbDeviceId, // Satisfy DB NOT NULL constraint; servers can still roam
            businessDate: new Date(),
            status: 'OPEN',
            bankType,
            bankingModel,
            primaryOperatorId: staff.id,
            openedBy: session?.user?.id || staff.id,
            expectedCash: 0,
            openingCash: 0
          }
        });
        activeSessionId = newSession.id;
      } else {
        return NextResponse.json({ error: 'This browser/device is not registered as a POS terminal. Please register it in settings first.' }, { status: 400 });
      }
    } else {
      // CENTRAL_CASHIER
      if (!dbDeviceId || !outletId) {
        return NextResponse.json({ error: 'This browser/device is not registered as a POS terminal. Please register it in settings first.' }, { status: 400 });
      }
      
      const openSession = await prisma.posSession.findFirst({
        where: { propertyId, outletId, deviceId: dbDeviceId, status: 'OPEN' },
        orderBy: { openedAt: 'desc' }
      });
      if (openSession) {
        activeSessionId = openSession.id;
      } else {
        requiresBank = true;
        activeSessionId = null;
        bankOwner = "MANAGER";
      }
    }

    const operatorToken = await new SignJWT({ 
      staffId: staff.id, 
      propertyId, 
      sessionId: activeSessionId,
      outletId,
      deviceId: dbDeviceId,
      tokenVersion: staff.posTokenVersion
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setJti(crypto.randomUUID())
      .setIssuedAt()
      .setExpirationTime('12h') // Valid for a 12 hour shift
      .sign(secret);

    // In a real app we'd also record this in PosAuthorizationAudit or similar
    // For now we just return success

    return NextResponse.json({ 
      data: {
        success: true,
        authenticated: true,
        operatorToken,
        bankingModel,
        sessionId: activeSessionId,
        requiresBank,
        bankOwner,
        staff: {
          id: staff.id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          position: staff.position
        }
      } 
    });
  } catch (error: any) {
    console.error('POS Auth Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error', detail: error?.code }, { status: 500 });
  }
}
