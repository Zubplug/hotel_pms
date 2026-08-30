import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { CashHandoverService } from '@/lib/services/cash-handover-service';
import prisma from '@hotel-pms/db';
import { getUserPropertyIds } from '@/lib/property-access';
import { CASH_HANDOVER_ROLES, hasFinancialRole } from '@/lib/financial-control-access';
import { isNightAuditTransactionLocked } from '@/lib/night-audit-guard';

export async function POST(request: NextRequest) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(actor.user as any).isSuperAdmin && !hasFinancialRole((actor.user as any).role, CASH_HANDOVER_ROLES)) return NextResponse.json({ error: 'Only Cash Management staff can create handovers' }, { status: 403 });

    const body = await request.json();
    const { propertyId, posSessionIds = [], frontdeskSessionIds = [], safeReference, notes } = body;

    if (!propertyId) return NextResponse.json({ error: 'Property ID is required' }, { status: 400 });
    if (!(await getUserPropertyIds(actor.user.id)).includes(propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (await isNightAuditTransactionLocked(propertyId)) {
      return NextResponse.json({ error: 'Cash handover cannot be created while Night Audit is posting. Retry after the new business date is active.', code: 'NIGHT_AUDIT_IN_PROGRESS' }, { status: 409 });
    }
    const staff = await prisma.staff.findFirst({ where: { userId: actor.user.id, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Staff record not found' }, { status: 401 });

    const handover = await CashHandoverService.createHandover({
      propertyId,
      creatorId: staff.id,
      posSessionIds,
      frontdeskSessionIds,
      safeReference,
      notes,
      idempotencyKey: request.headers.get('Idempotency-Key') || undefined
    });

    return NextResponse.json({ data: handover });
  } catch (error: any) {
    console.error('[Create Handover]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}
