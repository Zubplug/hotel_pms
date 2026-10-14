import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const canManage = HrAuthorizationService.can(context, 'hr.attendance.manage');
    const currentStaff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId }, select: { id: true } });
    if (!canManage && !currentStaff) return NextResponse.json({ error: 'Linked employee record not found' }, { status: 404 });
    const swaps = await prisma.shiftSwapRequest.findMany({ where: { propertyId: context.propertyId, ...(canManage ? {} : { OR: [{ requesterStaffId: currentStaff?.id || '__none__' }, { targetStaffId: currentStaff?.id || '__none__' }] }), ...(context.role === 'DEPARTMENT_HEAD' && context.department ? { requesterStaff: { department: context.department } } : {}), }, include: { requesterStaff: { select: { firstName: true, lastName: true, employeeId: true, department: true } }, targetStaff: { select: { firstName: true, lastName: true, employeeId: true, department: true } } }, orderBy: { createdAt: 'desc' }, take: 250 });
    const availableStaff = await prisma.staff.findMany({ where: { organizationId: context.organizationId, isActive: true, deletedAt: null, ...(context.propertyId ? { propertyAccess: { has: context.propertyId } } : {}), ...(context.role === 'DEPARTMENT_HEAD' && context.department ? { department: context.department } : {}) }, select: { id: true, firstName: true, lastName: true, employeeId: true, department: true }, orderBy: [{ department: 'asc' }, { firstName: 'asc' }] });
    return NextResponse.json({ swaps, availableStaff });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to retrieve shift swaps' }, { status: error.message?.includes('Forbidden') ? 403 : 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const requester = await prisma.staff.findFirst({ where: { ...HrAuthorizationService.staffScope(context, { id: body.requesterStaffId }), isActive: true }, select: { id: true, userId: true, department: true } });
    const target = await prisma.staff.findFirst({ where: { id: body.targetStaffId, organizationId: context.organizationId, ...(context.propertyId ? { propertyAccess: { has: context.propertyId } } : {}), isActive: true, deletedAt: null }, select: { id: true } });
    if (!requester || !target || requester.id === target.id || !body.requesterDate || !body.targetDate || !body.reason?.trim()) return NextResponse.json({ error: 'Valid distinct requester, target, dates, and reason are required' }, { status: 400 });
    if (requester.userId !== context.userId && !HrAuthorizationService.can(context, 'hr.attendance.manage')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const requesterRoster = await prisma.shiftRoster.findUnique({ where: { staffId_date: { staffId: requester.id, date: new Date(body.requesterDate) } } });
    const targetRoster = await prisma.shiftRoster.findUnique({ where: { staffId_date: { staffId: target.id, date: new Date(body.targetDate) } } });
    if (!requesterRoster || !targetRoster || requesterRoster.publicationStatus === 'CANCELLED' || targetRoster.publicationStatus === 'CANCELLED') return NextResponse.json({ error: 'Both employees must have active roster assignments before requesting a swap' }, { status: 400 });
    const swap = await prisma.shiftSwapRequest.create({ data: { propertyId: context.propertyId, requesterStaffId: requester.id, targetStaffId: target.id, requesterDate: new Date(body.requesterDate), targetDate: new Date(body.targetDate), reason: body.reason.trim() } });
    await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: target.id, subject: 'Shift swap request', body: 'A colleague has requested to swap a scheduled shift with you. Please review the request.', category: 'OPERATIONS', action: '/hr/shift-planning/swaps', idempotencyKey: `shift-swap:${swap.id}:target` });
    return NextResponse.json({ success: true, swap }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to create shift swap' }, { status: 400 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const currentStaff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId }, select: { id: true } });
    const canManage = HrAuthorizationService.can(context, 'hr.attendance.manage');
    const swap = await prisma.shiftSwapRequest.findFirst({ where: { id: body.id, propertyId: context.propertyId, ...(canManage ? {} : { OR: [{ requesterStaffId: currentStaff?.id || '__none__' }, { targetStaffId: currentStaff?.id || '__none__' }] }) } });
    if (!swap) return NextResponse.json({ error: 'Shift swap not found' }, { status: 404 });
    const isTarget = swap.targetStaffId === (await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId }, select: { id: true } }))?.id;
    if (body.action === 'PEER_APPROVE') {
      if (!isTarget || swap.status !== 'PENDING_PEER') return NextResponse.json({ error: 'Only the target employee can approve a pending peer swap' }, { status: 403 });
      const updated = await prisma.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: 'PENDING_SUPERVISOR', peerApprovedAt: new Date() } });
      await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: swap.requesterStaffId, subject: 'Shift swap accepted by colleague', body: 'Your shift swap request was accepted and is awaiting supervisor approval.', category: 'OPERATIONS', action: '/hr/shift-planning/swaps', idempotencyKey: `shift-swap:${swap.id}:peer-approved` });
      return NextResponse.json({ success: true, swap: updated });
    }
    if (body.action === 'PEER_REJECT') {
      if (!isTarget || swap.status !== 'PENDING_PEER') return NextResponse.json({ error: 'Only the target employee can reject a pending peer swap' }, { status: 403 });
      const updated = await prisma.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: 'REJECTED', rejectionReason: String(body.reason || '').trim() || 'Target employee declined the request' } });
      await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: swap.requesterStaffId, subject: 'Shift swap declined', body: 'The target employee declined your shift swap request.', category: 'OPERATIONS', action: '/hr/shift-planning/swaps', idempotencyKey: `shift-swap:${swap.id}:peer-rejected` });
      return NextResponse.json({ success: true, swap: updated });
    }
    if (body.action === 'CANCEL_REQUEST') {
      if (swap.requesterStaffId !== currentStaff?.id || !['PENDING_PEER', 'PENDING_SUPERVISOR'].includes(swap.status)) return NextResponse.json({ error: 'Only the requester can cancel an open swap' }, { status: 403 });
      return NextResponse.json({ success: true, swap: await prisma.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: 'CANCELLED' } }) });
    }
    HrAuthorizationService.assertPermission(context, 'hr.attendance.manage');
    if (!['APPROVED', 'REJECTED', 'CANCELLED'].includes(body.status)) return NextResponse.json({ error: 'Invalid swap status' }, { status: 400 });
    if (swap.status !== 'PENDING_SUPERVISOR' && body.status === 'APPROVED') return NextResponse.json({ error: 'Swap must be accepted by the target employee before supervisor approval' }, { status: 409 });
    if (body.status === 'APPROVED') {
      const result = await prisma.$transaction(async (tx) => {
        const from = await tx.shiftRoster.findUnique({ where: { staffId_date: { staffId: swap.requesterStaffId, date: swap.requesterDate } } });
        const to = await tx.shiftRoster.findUnique({ where: { staffId_date: { staffId: swap.targetStaffId, date: swap.targetDate } } });
        if (!from || !to) throw new Error('Both employees must have roster assignments before approval');
        await tx.shiftRoster.update({ where: { id: from.id }, data: { shiftId: to.shiftId, status: 'SWAPPED' } });
        await tx.shiftRoster.update({ where: { id: to.id }, data: { shiftId: from.shiftId, status: 'SWAPPED' } });
        return tx.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: 'APPROVED', supervisorApprovedAt: new Date(), supervisorUserId: context.userId } });
      });
      await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: swap.requesterStaffId, subject: 'Shift swap approved', body: 'Your shift swap has been approved and the rosters have been exchanged.', category: 'OPERATIONS', action: '/hr/self-service', idempotencyKey: `shift-swap:${swap.id}:approved` });
      await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: swap.targetStaffId, subject: 'Shift swap approved', body: 'The approved shift swap has been applied to your roster.', category: 'OPERATIONS', action: '/hr/self-service', idempotencyKey: `shift-swap:${swap.id}:approved-target` });
      return NextResponse.json({ success: true, swap: result });
    }
    return NextResponse.json({ success: true, swap: await prisma.shiftSwapRequest.update({ where: { id: swap.id }, data: { status: body.status, rejectionReason: body.rejectionReason?.trim() || null, supervisorApprovedAt: new Date(), supervisorUserId: context.userId } }) });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to process shift swap' }, { status: error.message?.includes('Forbidden') ? 403 : 400 }); }
}
