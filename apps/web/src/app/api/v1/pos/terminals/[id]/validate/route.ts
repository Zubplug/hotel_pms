import { NextRequest, NextResponse } from 'next/server';
import prisma, { effectiveSubscriptionDeadline, getOperationalSubscription } from '@hotel-pms/db';
import { hasEntitlement } from '@/lib/auth/entitlement';
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
    const [subscription, billingValid, pmsEntitlement] = await Promise.all([
      getOperationalSubscription(prisma, terminal.organisationId, now),
      hasEntitlement(terminal.organisationId, 'MODULE_PMS', terminal.propertyId),
      prisma.entitlement.findFirst({
        where: {
          organizationId: terminal.organisationId,
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

    // Subscription and entitlement deadlines are authoritative. Do not carry
    // forward a terminal's cached expiry: a converted trial must receive the
    // paid subscription deadline on its next validation.
    const expiryCandidates = [
      subscription ? effectiveSubscriptionDeadline(subscription) : null,
      pmsEntitlement?.expiresAt ?? null,
    ].filter((value): value is Date => value instanceof Date);
    const effectiveExpiry = expiryCandidates.length
      ? new Date(Math.min(...expiryCandidates.map((value) => value.getTime())))
      : null;
    const effectiveLicenseState = terminal.revokedAt
      ? 'RESTRICTED'
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
    }, { status: effectiveLicenseState === 'VALID' ? 200 : 402 });
  } catch (error: unknown) {
    console.error('Terminal Validate Error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
