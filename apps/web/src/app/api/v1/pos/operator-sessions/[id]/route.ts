import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const sessionId = params.id;
    const body = await req.json();
    const { lastActivityAt, lockedAt, endedAt, status } = body;

    const session = await prisma.posOperatorSession.update({
      where: { id: sessionId },
      data: {
        lastActivityAt: lastActivityAt ? new Date(lastActivityAt) : undefined,
        lockedAt: lockedAt ? new Date(lockedAt) : undefined,
        endedAt: endedAt ? new Date(endedAt) : undefined,
        status: status
      }
    });

    return NextResponse.json({ data: session });
  } catch (error: any) {
    console.error('Operator Session Update Error:', error);
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
