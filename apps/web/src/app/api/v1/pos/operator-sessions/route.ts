import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const deviceToken = authHeader.split(' ')[1];
    // In a real app we'd cache terminal validation. For simplicity here:
    // We expect the terminal ID to be passed in the body.
    const body = await req.json();
    const { id, terminalId, outletId, operatorId, startedAt, authenticationMethod } = body;

    const terminal = await prisma.posTerminal.findUnique({
      where: { id: terminalId }
    });

    if (!terminal) {
      return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
    }

    // Upsert the operator session (in case of sync retries)
    const session = await prisma.posOperatorSession.upsert({
      where: { id },
      update: {
        lastActivityAt: new Date(),
        status: 'ACTIVE'
      },
      create: {
        id,
        terminalId,
        outletId,
        operatorId,
        startedAt: new Date(startedAt),
        lastActivityAt: new Date(),
        status: 'ACTIVE',
        authenticationMethod: authenticationMethod || 'PIN'
      }
    });

    return NextResponse.json({ data: session });
  } catch (error: any) {
    console.error('Operator Session Sync Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
