import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { userId, propertyId, openingCash } = data;

    if (!userId || !propertyId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Get the first POS outlet for this property (for now)
    const outlet = await prisma.posOutlet.findFirst({
      where: { propertyId: propertyId }
    });

    if (!outlet) {
      return NextResponse.json({ error: 'No POS outlet configured for this property' }, { status: 400 });
    }

    // 2. Check if there's already an OPEN session for this user/outlet
    const existingSession = await prisma.posSession.findFirst({
      where: {
        outletId: outlet.id,
        status: 'OPEN',
        openedBy: userId
      }
    });

    if (existingSession) {
      return NextResponse.json({ data: { sessionId: existingSession.id } });
    }

    // 3. Create the PosSession
    const session = await prisma.posSession.create({
      data: {
        propertyId: propertyId,
        outletId: outlet.id,
        businessDate: new Date(),
        openingCash: openingCash || 0,
        expectedCash: openingCash || 0,
        openedBy: userId,
        status: 'OPEN'
      }
    });

    return NextResponse.json({ data: { sessionId: session.id } });

  } catch (error: any) {
    console.error('Error starting POS session:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
