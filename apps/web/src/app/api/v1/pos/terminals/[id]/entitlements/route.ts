import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyDeviceCredential } from '@/lib/pos/device-credential';

const NAVIGATION_MODULES = ['MODULE_PMS', 'MODULE_OPERATIONS', 'MODULE_ENTERPRISE'] as const;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authorization = req.headers.get('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing or invalid authorization header' }, { status: 401 });
    }

    const terminal = await prisma.posTerminal.findUnique({ where: { id: (await params).id } });
    if (!terminal) return NextResponse.json({ error: 'Terminal not found' }, { status: 404 });
    if (!(await verifyDeviceCredential(authorization.slice(7), terminal.deviceCredentialHash))) {
      return NextResponse.json({ error: 'Invalid device token' }, { status: 401 });
    }
    if (terminal.registrationState !== 'REGISTERED') {
      return NextResponse.json({ error: `Terminal is ${terminal.registrationState.toLowerCase()}` }, { status: 403 });
    }

    const now = new Date();
    const entitlements = await prisma.entitlement.findMany({
      where: {
        organizationId: terminal.organizationId,
        OR: [{ propertyId: terminal.propertyId }, { propertyId: null }],
      },
      select: { productCode: true, status: true, startsAt: true, expiresAt: true, quantity: true },
      orderBy: [{ productCode: 'asc' }, { propertyId: 'desc' }, { expiresAt: 'desc' }],
    });

    const active = entitlements.filter((item) =>
      item.status === 'ACTIVE'
      && item.startsAt <= now
      && (item.expiresAt === null || item.expiresAt > now),
    );
    const activeCodes = new Set(active.map((item) => item.productCode));

    return NextResponse.json({
      data: {
        organizationId: terminal.organizationId,
        propertyId: terminal.propertyId,
        capturedAt: now,
        enabledModules: NAVIGATION_MODULES.filter((module) => activeCodes.has(module)),
        enabledServices: active
          .map((item) => item.productCode)
          .filter((code) => !NAVIGATION_MODULES.includes(code as typeof NAVIGATION_MODULES[number])),
        entitlements,
      },
    });
  } catch (error: unknown) {
    console.error('Terminal Entitlements Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
