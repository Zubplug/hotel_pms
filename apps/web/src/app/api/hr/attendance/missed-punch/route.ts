import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.attendance.manage');
    const requests = await prisma.missedPunchRequest.findMany({ where: { propertyId: context.propertyId, staff: HrAuthorizationService.staffScope(context) }, include: { staff: { select: { firstName: true, lastName: true, employeeId: true, department: true } } }, orderBy: { createdAt: 'desc' }, take: 250 });
    return NextResponse.json({ requests });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to retrieve missed punches' }, { status: error.message?.includes('Forbidden') ? 403 : 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const staffId = body.staffId || (await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } }))?.id;
    if (!staffId || !body.date || !body.reason?.trim()) return NextResponse.json({ error: 'Staff, date, and reason are required' }, { status: 400 });
    const staff = await prisma.staff.findFirst({ where: { ...HrAuthorizationService.staffScope(context, { id: staffId }), isActive: true }, select: { id: true, userId: true } });
    if (!staff) return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
    const canManage = HrAuthorizationService.can(context, 'hr.attendance.manage');
    if (!canManage && staff.userId !== context.userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const request = await prisma.missedPunchRequest.create({ data: { propertyId: context.propertyId, staffId, date: new Date(body.date), requestedIn: body.requestedIn ? new Date(body.requestedIn) : null, requestedOut: body.requestedOut ? new Date(body.requestedOut) : null, reason: body.reason.trim() } });
    await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId, subject: 'Attendance correction submitted', body: 'Your missed-punch correction is awaiting review.', category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `missed-punch:${request.id}:submitted` });
    return NextResponse.json({ success: true, request }, { status: 201 });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to create missed punch request' }, { status: 400 }); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.attendance.manage');
    const body = await req.json();
    if (!body.id || !['APPROVED', 'REJECTED'].includes(body.status)) return NextResponse.json({ error: 'Request ID and APPROVED or REJECTED status are required' }, { status: 400 });
    if (body.status === 'REJECTED' && String(body.reviewerNotes || '').trim().length < 5) return NextResponse.json({ error: 'A rejection reason of at least 5 characters is required' }, { status: 400 });
    const request = await prisma.missedPunchRequest.findFirst({ where: { id: body.id, propertyId: context.propertyId, staff: HrAuthorizationService.staffScope(context) } });
    if (!request) return NextResponse.json({ error: 'Missed punch request not found' }, { status: 404 });
    if (request.status !== 'PENDING') return NextResponse.json({ error: `Request has already been ${request.status.toLowerCase()}` }, { status: 409 });
    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.missedPunchRequest.update({ where: { id: request.id }, data: { status: body.status, reviewedByUserId: context.userId, reviewedAt: new Date(), reviewerNotes: body.reviewerNotes?.trim() || null } });
      if (body.status === 'APPROVED') {
        await tx.attendanceRecord.upsert({ where: { staffId_date: { staffId: request.staffId, date: request.date } }, update: { clockIn: request.requestedIn, clockOut: request.requestedOut, status: 'PRESENT', verifiedByUserId: context.userId, supervisorVerified: true, verifiedAt: new Date(), notes: `Approved missed punch request ${request.id}` }, create: { propertyId: request.propertyId, staffId: request.staffId, date: request.date, clockIn: request.requestedIn, clockOut: request.requestedOut, status: 'PRESENT', punchSource: 'MANUAL', verifiedByUserId: context.userId, supervisorVerified: true, verifiedAt: new Date(), notes: `Approved missed punch request ${request.id}` } });
      }
      return saved;
    });
    await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: request.staffId, subject: `Attendance correction ${updated.status.toLowerCase()}`, body: updated.status === 'APPROVED' ? 'Your missed-punch correction was approved and added to attendance.' : `Your missed-punch correction was rejected. Note: ${body.reviewerNotes}`, category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `missed-punch:${request.id}:${updated.status}` });
    return NextResponse.json({ success: true, request: updated });
  } catch (error: any) { return NextResponse.json({ error: error.message || 'Failed to review missed punch request' }, { status: error.message?.includes('Forbidden') ? 403 : 400 }); }
}
