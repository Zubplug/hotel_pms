import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const canReview = HrAuthorizationService.can(context, 'hr.attendance.manage') || HrAuthorizationService.can(context, 'hr.employee.view');
    const currentStaff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId }, select: { id: true } });
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const appealStatus = searchParams.get('appealStatus');
    const assessments = await prisma.attendancePenaltyAssessment.findMany({
      where: {
        propertyId: context.propertyId,
        ...(status === 'PENDING' && appealStatus === 'PENDING'
          ? { OR: [{ status: 'PENDING' }, { appealStatus: 'PENDING' }] }
          : { ...(status ? { status } : {}), ...(appealStatus ? { appealStatus } : {}) }),
        ...(canReview ? {} : { staffId: currentStaff?.id || '__none__' }),
        staff: context.department && context.role === 'DEPARTMENT_HEAD' ? { department: context.department } : undefined,
      },
      include: { staff: { select: { firstName: true, lastName: true, department: true, position: true } }, policy: { select: { name: true, code: true, calculationType: true } } },
      orderBy: [{ status: 'asc' }, { eventDate: 'desc' }],
      take: 500,
    });
    return NextResponse.json({ assessments: assessments.map((assessment) => ({ ...assessment, assessedAmount: Number(assessment.assessedAmount) })) });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to retrieve attendance penalties' }, { status: error.message?.includes('Forbidden') ? 403 : 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const currentStaff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId }, select: { id: true } });
    if (body.action === 'APPEAL') {
      if (!currentStaff || !String(body.reason || '').trim() || String(body.reason).trim().length < 10) return NextResponse.json({ error: 'A detailed appeal reason is required' }, { status: 400 });
      const assessment = await prisma.attendancePenaltyAssessment.findFirst({ where: { id: body.id, propertyId: context.propertyId, staffId: currentStaff.id, status: { in: ['PENDING', 'APPROVED'] }, payrollPeriodId: null } });
      if (!assessment) return NextResponse.json({ error: 'This charge cannot be appealed after payroll application' }, { status: 404 });
      const updated = await prisma.attendancePenaltyAssessment.update({ where: { id: assessment.id }, data: { appealStatus: 'PENDING', appealReason: String(body.reason).trim(), appealedAt: new Date() } });
      await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: currentStaff.id, subject: 'Penalty appeal submitted', body: 'Your attendance charge appeal has been submitted to HR for review.', category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `penalty-appeal:${assessment.id}:${updated.appealedAt?.toISOString()}` });
      return NextResponse.json({ success: true, assessment: updated });
    }
    HrAuthorizationService.assertPermission(context, 'hr.attendance.manage');
    if (body.action === 'RESOLVE_APPEAL') {
      const appealDecision = String(body.status || '').toUpperCase();
      if (!body.id || !['UPHELD', 'REJECTED'].includes(appealDecision)) return NextResponse.json({ error: 'A valid appeal decision is required' }, { status: 400 });
      const assessment = await prisma.attendancePenaltyAssessment.findFirst({ where: { id: body.id, propertyId: context.propertyId, appealStatus: 'PENDING', payrollPeriodId: null } });
      if (!assessment) return NextResponse.json({ error: 'Pending penalty appeal not found' }, { status: 404 });
      const updated = await prisma.attendancePenaltyAssessment.update({ where: { id: assessment.id }, data: { appealStatus: appealDecision, appealReviewedById: context.userId, appealReviewedAt: new Date(), status: appealDecision === 'REJECTED' ? 'WAIVED' : assessment.status } });
      await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: assessment.staffId, subject: `Penalty appeal ${appealDecision.toLowerCase()}`, body: appealDecision === 'UPHELD' ? 'HR reviewed your appeal and confirmed the attendance charge.' : 'HR reviewed your appeal and waived the attendance charge.', category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `penalty-appeal:${assessment.id}:${appealDecision}` });
      return NextResponse.json({ success: true, assessment: updated });
    }
    const status = String(body.status || '').toUpperCase();
    if (!body.id || !['APPROVED', 'REJECTED', 'WAIVED'].includes(status)) return NextResponse.json({ error: 'A valid assessment and review status are required' }, { status: 400 });
    if (status === 'REJECTED' && String(body.reason || '').trim().length < 10) return NextResponse.json({ error: 'A detailed rejection reason is required' }, { status: 400 });
    const assessment = await prisma.attendancePenaltyAssessment.findFirst({ where: { id: body.id, propertyId: context.propertyId, status: 'PENDING' } });
    if (!assessment) return NextResponse.json({ error: 'Pending penalty assessment not found' }, { status: 404 });
    const updated = await prisma.$transaction(async (tx) => {
      const result = await tx.attendancePenaltyAssessment.update({ where: { id: assessment.id }, data: { status, reviewedById: context.userId, reviewedAt: new Date(), rejectionReason: status === 'REJECTED' ? String(body.reason).trim() : null } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, propertyId: context.propertyId, userId: context.userId, action: `HR_ATTENDANCE_PENALTY_${status}`, resource: 'AttendancePenaltyAssessment', resourceId: result.id, previousValue: { status: 'PENDING', amount: Number(assessment.assessedAmount) }, newValue: { status, amount: Number(result.assessedAmount), reason: body.reason || null }, requestId: randomUUID() } });
      return result;
    });
    await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: assessment.staffId, subject: `Attendance charge ${status.toLowerCase()}`, body: status === 'APPROVED' ? 'An attendance charge was approved by HR and may be included in a future payroll period. You may appeal it from your employee portal before payroll application.' : status === 'WAIVED' ? 'An attendance charge was waived by HR.' : `An attendance charge was rejected. ${String(body.reason || '').trim()}`, category: 'PAYROLL', action: '/hr/self-service', idempotencyKey: `penalty-assessment:${assessment.id}:${status}` });
    return NextResponse.json({ success: true, assessment: { ...updated, assessedAmount: Number(updated.assessedAmount) } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to review attendance penalty' }, { status: error.message?.includes('Forbidden') ? 403 : 400 });
  }
}
