import { NextRequest, NextResponse } from 'next/server';
import prisma, { expireTrial, reconcileOrganizationEntitlements } from '@hotel-pms/db';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!expected || supplied !== expected) return new NextResponse('Unauthorized', { status: 401 });

  const now = new Date();
  const candidates = await prisma.subscription.findMany({
    where: { status: 'TRIALING', trialEndsAt: { lte: now } },
    select: { id: true, organizationId: true },
    orderBy: { trialEndsAt: 'asc' },
    take: 100,
  });
  let expired = 0;
  let skipped = 0;

  for (const candidate of candidates) {
    const claimed = await expireTrial(prisma, { subscriptionId: candidate.id, now });
    if (!claimed) {
      skipped += 1;
      continue;
    }
    await prisma.$transaction(async (tx) => {
      await reconcileOrganizationEntitlements(tx, candidate.organizationId, now);
      await tx.auditLog.create({
        data: {
          organizationId: candidate.organizationId,
          userEmail: 'billing.system@lodgecore.internal',
          userRole: 'SYSTEM',
          action: 'TRIAL_EXPIRED',
          resource: 'Subscription',
          resourceId: candidate.id,
          newValue: { status: 'EXPIRED', expiredAt: now.toISOString() },
          requestId: `trial-expiry:${candidate.id}:${now.toISOString().slice(0, 10)}`,
        },
      });
    });
    expired += 1;
  }

  return NextResponse.json({ checked: candidates.length, expired, skipped });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
