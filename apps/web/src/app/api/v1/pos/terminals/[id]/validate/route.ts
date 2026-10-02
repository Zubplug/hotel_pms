import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { verifyDeviceCredential } from '@/lib/pos/device-credential';

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

    const isTokenValid = await verifyDeviceCredential(deviceToken, terminal.deviceCredentialHash);
    if (!isTokenValid) {
      return NextResponse.json({ error: 'Invalid device token' }, { status: 401 });
    }

    const now = new Date();
    const [subscription, pmsEntitlement] = await Promise.all([
      prisma.subscription.findFirst({
        where: {
          organizationId: terminal.organizationId,
          status: { in: ['ACTIVE', 'TRIALING', 'PAST_DUE'] },
          planId: { not: null },
          currentPeriodEnd: { gt: now },
        },
        select: { currentPeriodEnd: true },
        orderBy: { currentPeriodEnd: 'desc' },
      }),
      prisma.entitlement.findFirst({
        where: {
          organizationId: terminal.organizationId,
          productCode: 'MODULE_PMS',
          status: 'ACTIVE',
          startsAt: { lte: now },
          OR: [{ propertyId: terminal.propertyId }, { propertyId: null }],
          AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] }],
        },
        select: { expiresAt: true },
        orderBy: { expiresAt: 'desc' },
      }),
    ]);

    const billingValid = Boolean(subscription && pmsEntitlement);
    const expiryCandidates = [
      terminal.licenseExpiresAt,
      subscription?.currentPeriodEnd ?? null,
      pmsEntitlement?.expiresAt ?? null,
    ].filter((value): value is Date => value instanceof Date);
    const effectiveExpiry = expiryCandidates.length
      ? new Date(Math.min(...expiryCandidates.map((value) => value.getTime())))
      : null;
    const effectiveLicenseState = terminal.revokedAt
      ? 'REVOKED'
      : billingValid && terminal.licenseState !== 'RESTRICTED'
        ? 'VALID'
        : 'EXPIRED';

    // Update last seen
    await prisma.posTerminal.update({
      where: { id: (await params).id },
      data: {
        lastSeenAt: now,
        licenseState: effectiveLicenseState,
        licenseExpiresAt: effectiveExpiry,
      }
    });

    return NextResponse.json({
      data: {
        isValid: terminal.registrationState === 'REGISTERED'
          && effectiveLicenseState === 'VALID'
          && !terminal.revokedAt,
        terminal: {
          status: terminal.registrationState,
          licenseState: effectiveLicenseState,
          licenseExpiresAt: effectiveExpiry,
          revokedAt: terminal.revokedAt,
        }
      }
    });
  } catch (error: unknown) {
    console.error('Terminal Validate Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
