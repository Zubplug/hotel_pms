import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { createHash } from 'crypto';
import { compare, hash } from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const deviceToken = authHeader.substring(7);
    const body = await req.json();
    const { propertyId } = body;

    if (!propertyId) {
      return NextResponse.json({ error: 'propertyId is required' }, { status: 400 });
    }

    // Verify terminal
    const terminals = await prisma.posTerminal.findMany({
      where: { propertyId, registrationState: 'REGISTERED' }
    });

    let device = null;
    const sha256Hash = createHash('sha256').update(deviceToken).digest('hex');

    for (const t of terminals) {
      if (t.deviceCredentialHash) {
        if (t.deviceCredentialHash === sha256Hash) {
           device = t;
           break;
        }
        if (t.deviceCredentialHash.length === 60) {
           if (await compare(deviceToken, t.deviceCredentialHash)) {
             device = t;
             break;
           }
        }
      }
    }

    if (!device) {
      return NextResponse.json({ error: 'Terminal not authorized' }, { status: 403 });
    }

    // Generate new token
    const newToken = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0')).join('');
      
    const newHash = createHash('sha256').update(newToken).digest('hex');

    await prisma.posTerminal.update({
      where: { id: device.id },
      data: {
        deviceCredentialHash: newHash,
        lastSeenAt: new Date()
      }
    });

    return NextResponse.json({ success: true, deviceToken: newToken });
  } catch (error: any) {
    console.error('Device refresh error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
