import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.attendance.manage');
    const swaps = await prisma.shiftSwapRequest.findMany({ where: { propertyId: context.propertyId, ...(context.role === 'DEPARTMENT_HEAD' && context.department ? { requesterStaff: { department: context.department } } : {}), }, include: { requesterStaff: { select: { firstName: true, lastName: true, employeeId: true, department: true } }, targetStaff: { select: { firstName: true, lastName: true, employeeId: true, department: true } } }, orderBy: { createdAt: 'desc' }, take: 250 });
    return NextResponse.json({ swaps });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to retrieve shift swaps' }, { status: error.message?.includes('Forbidden') ? 403 : 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const requester = await prisma.staff.findFirst({ where: { ...HrAuthorizationService.staffScope(context, { id: body.requesterStaffId }), isActive: true }, select: { id: true, userId: true, department: true } });
    const target = await prisma.staff.findFirst({ where: { ...HrAuthorizationService.staffScope(context, { id: body.targetStaffId }), isActive: true }, select: { id: true } });
    if (!requester || !target || requester.id === target.id || !body.requesterDate || !body.targetDate || !body.reason?.trim()) return NextResponse.json({ error: 'Valid distinct requester, target, dates, and reason are required' }, { status: 400 });
    if (requester.userId !== context.userId && !HrAuthorizationService.can(context, 'hr.attendance.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const swap = await prisma.shiftSwapRequest.create({ data: { propertyId: context.propertyId, requesterStaffId: requester.id, targetStaffId: target.id, requesterDate: new Date(body.requesterDate), targetDate: new Date(body.targetDate), reason: body.reason.trim() } });
    return NextResponse.json({ success: true, swap }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to create shift swap' }, { status: 400 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const swap = await prisma.shiftSwapRequest.findFirst({ where: { id: body.id, propertyId: context.propertyId, requesterStaff: HrAuthorizationService.staffScope(context) } });
    if (!swap) return NextResponse.json({ error: 'Shift swap not found' }, { status: 404 });
    const isTarget = swap.targetStaffId === (await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId }, select: { id: true } }))?.id;
    if (body.action === 'PEER_APPROVE') {
      if (!isTarget || swap.status !== 'PENDING_PEER') return NextResponse.json({ error: 'Only the target employee can approve a pending peer swap' }, { status: 403 });
      return NextResponse.json({ success: true, swap: await prisma.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: 'PENDING_SUPERVISOR', peerApprovedAt: new Date() } }) });
    }
    HrAuthorizationService.assertPermission(context, 'hr.attendance.manage');
    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(body.status)) return NextResponse.json({ error: 'Invalid swap status' }, { status: 400 });
    if (body.status === 'APPROVED') {
      const result = await prisma.$transaction(async (tx) => {
        const from = await tx.shiftRoster.findUnique({ where: { staffId_date: { staffId: swap.requesterStaffId, date: swap.requesterDate } } });
        const to = await tx.shiftRoster.findUnique({ where: { staffId_date: { staffId: swap.targetStaffId, date: swap.targetDate } } });
        if (!from || !to) throw new Error('Both employees must have roster assignments before approval');
        await tx.shiftRoster.update({ where: { id: from.id }, data: { shiftId: to.shiftId, status: 'SWAPPED' } });
        await tx.shiftRoster.update({ where: { id: to.id }, data: { shiftId: from.shiftId, status: 'SWAPPED' } });
        return tx.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: 'APPROVED', supervisorApprovedAt: new Date(), supervisorUserId: context.userId } });
      });
      return NextResponse.json({ success: true, swap: result });
    }
    return NextResponse.json({ success: true, swap: await prisma.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: body.status, rejectionReason: body.rejectionReason?.trim() || null, supervisorApprovedAt: new Date(), supervisorUserId: context.userId } }) });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to process shift swap' }, { status: error.message?.includes('Forbidden') ? 403 : 400 }); }
}
