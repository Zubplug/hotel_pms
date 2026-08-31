import { NextRequest, NextResponse } from 'next/server';
import { authenticateSyncRequest } from '@/lib/sync-auth';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const propertyId = new URL(req.url).searchParams.get('propertyId');
    const eventIds = (new URL(req.url).searchParams.get('eventIds') || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    
    if (!propertyId || !eventIds.length) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const authResult = await authenticateSyncRequest(req, propertyId);
    if (!authResult.success || !authResult.isDevice) {
      return NextResponse.json({ error: authResult.success ? 'Must be a device' : authResult.error }, { status: authResult.success ? 403 : authResult.status });
    }
    
    const deviceId = authResult.deviceId;

    const events = await prisma.hotelEvent.findMany({
      where: {
        id: { in: eventIds },
        propertyId,
        deviceId,
        syncConflict: { is: { status: { not: 'PENDING' } } }
      },
      include: { syncConflict: { select: { status: true, resolution: true } } }
    });

    return NextResponse.json({
      resolutions: events.map(event => ({
        eventId: event.id,
        status: event.syncConflict?.status,
        resolution: event.syncConflict?.resolution
      }))
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching sync conflict statuses:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
