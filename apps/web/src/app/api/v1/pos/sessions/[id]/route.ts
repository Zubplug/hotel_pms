import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const posSession = await prisma.posSession.findUnique({
      where: { id: params.id },
      include: {
        outlet: true,
        device: true,
        openedByUser: {
          select: { name: true, email: true }
        }
      }
    });

    if (!posSession) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Security check: ensure session belongs to user's property
    const propertyId = (session.user as any).propertyId;
    if (propertyId && posSession.propertyId !== propertyId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    return NextResponse.json({ data: posSession });
  } catch (error: any) {
    console.error('Error fetching POS session:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
