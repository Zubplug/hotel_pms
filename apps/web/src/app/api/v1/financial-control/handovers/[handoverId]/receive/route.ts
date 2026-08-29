import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { CashHandoverService } from '@/lib/services/cash-handover-service';
import prisma from '@hotel-pms/db';
import { getUserPropertyIds } from '@/lib/property-access';
import { CASH_HANDOVER_ROLES, hasFinancialRole } from '@/lib/financial-control-access';

export async function POST(request: NextRequest, context: { params: Promise<{ handoverId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!(actor.user as any).isSuperAdmin && !hasFinancialRole((actor.user as any).role, CASH_HANDOVER_ROLES)) return NextResponse.json({ error: 'Only Cash Management staff can receive handovers' }, { status: 403 });

    const { handoverId } = await context.params;
    const body = await request.json();
    const { notes } = body;
    const handover = await prisma.cashHandover.findUnique({ where: { id: handoverId }, select: { propertyId: true } });
    if (!handover) return NextResponse.json({ error: 'Handover not found' }, { status: 404 });
    if (!(await getUserPropertyIds(actor.user.id)).includes(handover.propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const userRec = await prisma.user.findUnique({ where: { id: actor.user.id }, select: { staffId: true } });
    const staff = await prisma.staff.findFirst({ 
      where: { 
        OR: [
          { userId: actor.user.id },
          ...(userRec?.staffId ? [{ id: userRec.staffId }] : [])
        ],
        isActive: true
      }, 
      select: { id: true } 
    });
    if (!staff) return NextResponse.json({ error: 'Staff record not found' }, { status: 401 });

    const result = await CashHandoverService.receiveHandover({
      handoverId,
      receiverId: staff.id,
      notes
    });

    return NextResponse.json({ data: result });
  } catch (error: any) {
    console.error('[Receive Handover]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 });
  }
}
