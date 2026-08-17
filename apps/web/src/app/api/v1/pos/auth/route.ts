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
    const { staffId, pin, propertyId, sessionId, outletId, deviceId } = body;

    if (!staffId || !pin || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields: staffId, pin, sessionId' }, { status: 400 });
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
    if (!process.env.NEXTAUTH_SECRET) throw new Error('NEXTAUTH_SECRET missing');
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
    const operatorToken = await new SignJWT({ 
      staffId: staff.id, 
      propertyId, 
      sessionId,
      outletId,
      deviceId,
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
        operatorToken,
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
