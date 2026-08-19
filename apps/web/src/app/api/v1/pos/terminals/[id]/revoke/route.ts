import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();
    if (!session?.user?.propertyId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const terminal = await prisma.posTerminal.findUnique({
      where: { id }
    });

    if (!terminal || terminal.propertyId !== session.user.propertyId) {
      return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
    }

    const revokedTerminal = await prisma.posTerminal.update({
      where: { id },
      data: {
        status: 'REVOKED',
        revokedAt: new Date()
      }
    });

    return NextResponse.json({ data: revokedTerminal });
  } catch (error: any) {
    console.error('Terminal Revoke Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
