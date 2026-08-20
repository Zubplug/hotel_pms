import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    // In a real app we would check admin session or device token depending on the caller.
    // For now we just return the terminal details without sensitive tokens.
    const terminal = await prisma.posTerminal.findUnique({
      where: { id: (await params).id },
      include: { outlet: true }
    });

    if (!terminal) {
      return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
    }

    return NextResponse.json({
      data: {
        id: terminal.id,
        terminalCode: terminal.terminalCode,
        name: terminal.name,
        terminalType: terminal.terminalType,
        propertyId: terminal.propertyId,
        outletId: terminal.outletId,
        registrationState: terminal.registrationState,
        licenseState: terminal.licenseState,
        autoLockSeconds: terminal.autoLockSeconds ?? terminal.outlet.autoLockSeconds,
        lastSyncAt: terminal.lastSyncAt
      }
    });
  } catch (error: any) {
    console.error('Terminal Fetch Error:', error);
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
