import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { activateTrial, TrialAlreadyUsedError, TrialIdempotencyConflictError, TrialPlanNotFoundError } from '@hotel-pms/db';
import prisma from '@hotel-pms/db';

export async function POST(request: NextRequest) {
  const session = await auth();
  const organizationId = (session?.user as { organizationId?: string } | undefined)?.organizationId;
  if (!organizationId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const planCode = typeof body.planCode === 'string' ? body.planCode : undefined;
  const idempotencyKey = request.headers.get('idempotency-key') || (typeof body.idempotencyKey === 'string' ? body.idempotencyKey : undefined);
  if (!idempotencyKey?.trim()) return NextResponse.json({ error: 'An idempotency key is required' }, { status: 400 });

  try {
    const subscription = await activateTrial(prisma, { organizationId, planCode, idempotencyKey });
    return NextResponse.json({
      subscriptionId: subscription.id,
      status: subscription.status,
      planId: subscription.planId,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof TrialAlreadyUsedError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof TrialIdempotencyConflictError) return NextResponse.json({ error: error.message }, { status: 409 });
    if (error instanceof TrialPlanNotFoundError) return NextResponse.json({ error: error.message }, { status: 400 });
    console.error('Trial activation failed:', error);
    return NextResponse.json({ error: 'Unable to start trial' }, { status: 500 });
  }
}
