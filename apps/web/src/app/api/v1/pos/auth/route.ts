import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';
import { auth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { staffId, pin, propertyId, sessionId } = body;

    if (!staffId || !pin || !sessionId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    // In a real app we'd also record this in PosAuthorizationAudit or similar
    // For now we just return success

    return NextResponse.json({ 
      data: {
        success: true,
        staff: {
          id: staff.id,
          firstName: staff.firstName,
          lastName: staff.lastName,
          position: staff.position
        }
      } 
    });
  } catch (error) {
    console.error('POS Auth Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
