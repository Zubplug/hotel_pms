import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { compare } from 'bcryptjs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const deviceToken = authHeader.split(' ')[1];

    const terminal = await prisma.posTerminal.findUnique({
      where: { id: (await params).id }
    });

    if (!terminal) {
      return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
    }

    if (terminal.registrationState !== 'REGISTERED') {
      return NextResponse.json({ error: `Terminal is ${terminal.registrationState.toLowerCase()}` }, { status: 403 });
    }

    const isTokenValid = await compare(deviceToken, terminal.deviceCredentialHash);
    if (!isTokenValid) {
      return NextResponse.json({ error: 'Invalid device token' }, { status: 401 });
    }

    // Update last seen
    await prisma.posTerminal.update({
      where: { id: (await params).id },
      data: { lastSeenAt: new Date() }
    });

    return NextResponse.json({
      data: {
        isValid: true,
        terminal: {
          status: terminal.registrationState,
          licenseState: terminal.licenseState
        }
      }
    });
  } catch (error: any) {
    console.error('Terminal Validate Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
