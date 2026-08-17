import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const propertyId = searchParams.get('propertyId');
    const status = searchParams.get('status') || 'PENDING';

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId required' }, { status: 400 });
    }

    const conflicts = await prisma.syncConflict.findMany({
      where: {
        propertyId,
        status: status as any
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ conflicts }, { status: 200 });
  } catch (error: any) {
    console.error('Fetch conflicts error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
