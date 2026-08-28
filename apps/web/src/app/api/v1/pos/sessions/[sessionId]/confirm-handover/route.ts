import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { getUserPropertyIds } from '@/lib/property-access';
import { compare } from 'bcryptjs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ sessionId: string }> }) {
  try {
    const actor = await auth();
    if (!actor?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { sessionId } = await params;
    const { managerPin } = await request.json();
    if (!managerPin) return NextResponse.json({ error: 'Manager PIN is required' }, { status: 400 });

    const current = await prisma.posSession.findUnique({ where: { id: sessionId }, include: { settlements: { orderBy: { settledAt: 'desc' }, take: 1 } } });
    if (!current || !current.propertyId) return NextResponse.json({ error: 'POS session not found' }, { status: 404 });
    const allowed = await getUserPropertyIds(actor.user.id);
    if (!allowed.includes(current.propertyId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const settlement = current.settlements[0];
    if (!settlement || settlement.status !== 'PENDING_HANDOVER') return NextResponse.json({ error: 'No pending handover exists for this session' }, { status: 409 });

    const managers = await prisma.staff.findMany({ where: { propertyAccess: { has: current.propertyId }, isActive: true, posPinHash: { not: null }, position: { in: ['MANAGER', 'HOTEL_MANAGER', 'GENERAL_CASHIER', 'CEO', 'SUPER_ADMIN'] } }, select: { id: true, posPinHash: true } });
    const manager = (await Promise.all(managers.map(async candidate => candidate.posPinHash && await compare(managerPin, candidate.posPinHash) ? candidate : null))).find(Boolean);
    if (!manager) return NextResponse.json({ error: 'Invalid manager PIN or insufficient permissions' }, { status: 403 });
    if (manager.id === settlement.operatorId || manager.id === current.openedBy) return NextResponse.json({ error: 'The manager cannot approve the shift they operated' }, { status: 403 });

    const result = await prisma.$transaction(async tx => {
      const updated = await tx.posSettlement.update({ where: { id: settlement.id }, data: { status: 'CLOSED', authorizerId: manager.id } });
      await tx.posSession.update({ where: { id: sessionId }, data: { status: 'CLOSED', approvedBy: manager.id, approvedAt: new Date() } });
      return updated;
    });
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error('[POS confirm handover]', error);
    return NextResponse.json({ error: 'Unable to confirm POS handover' }, { status: 500 });
  }
}
