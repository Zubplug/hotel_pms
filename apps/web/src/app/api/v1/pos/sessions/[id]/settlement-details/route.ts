import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const resolvedParams = await params;
    const posSessionId = resolvedParams.id;

    const posSession = await prisma.posSession.findUnique({
      where: { id: posSessionId }
    });

    if (!posSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // In a robust system, expectedCash could be dynamically calculated by summing cash payments
    // For now, we rely on the incrementally updated expectedCash on the session record
    return NextResponse.json({
      data: {
        expectedCash: Number(posSession.expectedCash)
      }
    });

  } catch (error: any) {
    console.error('Error in settlement-details:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
