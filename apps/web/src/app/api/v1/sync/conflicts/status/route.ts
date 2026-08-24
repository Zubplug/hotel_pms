import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { createHash } from 'crypto';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const propertyId = new URL(req.url).searchParams.get('propertyId');
    const eventIds = (new URL(req.url).searchParams.get('eventIds') || '')
      .split(',')
      .map(value => value.trim())
      .filter(Boolean);
    const authHeader = req.headers.get('Authorization');
    if (!propertyId || !eventIds.length || !authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
    }

    const token = authHeader.substring(7);
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const terminals = await prisma.posTerminal.findMany({
      where: { propertyId, registrationState: 'REGISTERED' },
      select: { id: true, deviceCredentialHash: true }
    });
    const device = (await Promise.all(terminals.map(async terminal => {
      if (!terminal.deviceCredentialHash) return null;
      if (terminal.deviceCredentialHash === tokenHash) return terminal;
      if (terminal.deviceCredentialHash.length === 60 && await compare(token, terminal.deviceCredentialHash)) return terminal;
      return null;
    }))).find(Boolean);
    if (!device) return NextResponse.json({ error: 'Terminal not authorized' }, { status: 403 });

    const events = await prisma.hotelEvent.findMany({
      where: {
        id: { in: eventIds },
        propertyId,
        deviceId: device.id,
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
