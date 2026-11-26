import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';
import { verifyOperatorToken } from '@/lib/pos/operatorAuth';
import { BreakfastEntitlementService } from '@/lib/services/breakfast-entitlement-service';

const RedemptionSchema = z.object({
  reservationId: z.string().uuid(),
  roomNumber: z.string().min(1),
  coversRedeemed: z.number().int().min(1),
  menuItemId: z.string().uuid().nullish(),
  menuItemName: z.string().trim().min(1).max(120),
  operationId: z.string().min(8).max(160),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const propertyId = (session?.user as any)?.propertyId;
    const userId = (session?.user as any)?.id;
    if (!propertyId || !userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });

    const organization = await requireOrganizationContext(userId);
    if (!organization.propertyIds.includes(propertyId)) return NextResponse.json({ error: 'Property access denied' }, { status: 403 });

    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    const operator = token ? await verifyOperatorToken(token) : null;
    if (!operator) return NextResponse.json({ error: 'An authenticated POS operator is required' }, { status: 401 });

    const parsed = RedemptionSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: 'Invalid breakfast redemption data' }, { status: 400 });

    const posSession = await prisma.posSession.findFirst({
      where: { id: operator.sessionId, propertyId, status: 'OPEN' },
      include: { outlet: { select: { posType: true, isActive: true } } },
    });
    if (!posSession || !posSession.outlet.isActive || posSession.outlet.posType !== 'RESTAURANT_POS') {
      return NextResponse.json({ error: 'Breakfast service is available only on an open Restaurant POS shift.' }, { status: 409 });
    }

    const redemption = await BreakfastEntitlementService.recordRedemption({
      propertyId,
      reservationId: parsed.data.reservationId,
      roomNumber: parsed.data.roomNumber,
      businessDate: posSession.businessDate,
      coversRedeemed: parsed.data.coversRedeemed,
      serverStaffId: operator.staffId,
      method: 'POS_TICKET',
      operationId: parsed.data.operationId,
      menuItemId: parsed.data.menuItemId || undefined,
      menuItemName: parsed.data.menuItemName,
    });

    return NextResponse.json({ data: { redemption, businessDate: posSession.businessDate } });
  } catch (error: any) {
    console.error('[POST /api/v1/fnb/breakfast/redeem]', error);
    const message = error?.message || 'Unable to redeem breakfast';
    const status = message.startsWith('REDEMPTION_DENIED') || message.startsWith('COVERS_EXHAUSTED') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
