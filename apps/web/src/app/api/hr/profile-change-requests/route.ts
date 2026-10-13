import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

function errorResponse(error: any) {
  const message = String(error?.message || 'Profile change review failed');
  return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500 });
}

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.employee.manage');
    const requests = await prisma.employeeChangeRequest.findMany({ where: { staff: HrAuthorizationService.staffScope(context) }, include: { staff: { select: { firstName: true, lastName: true, employeeId: true, department: true } } }, orderBy: { createdAt: 'desc' }, take: 250 });
    return NextResponse.json({ requests });
  } catch (error) { return errorResponse(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.employee.manage');
    const body = await req.json();
    if (!body.id || !['APPROVED', 'REJECTED', 'CLARIFICATION'].includes(body.status)) return NextResponse.json({ error: 'Request ID and valid review status are required' }, { status: 400 });
    const existing = await prisma.employeeChangeRequest.findFirst({ where: { id: body.id, staff: HrAuthorizationService.staffScope(context) }, include: { staff: { include: { employeeProfile: true, salaryStructure: true } } } });
    if (!existing) return NextResponse.json({ error: 'Profile change request not found' }, { status: 404 });
    const request = await prisma.$transaction(async (tx) => {
      if (body.status === 'APPROVED') {
        let value: any = existing.proposedValue;
        try { value = JSON.parse(existing.proposedValue); } catch { /* scalar value */ }
        const field = existing.fieldName;
        if (field === 'phone') await tx.staff.update({ where: { id: existing.staffId }, data: { phone: String(value) } });
        else if (field === 'personalEmail') {
          const email = String(value).trim().toLowerCase();
          await tx.staff.update({ where: { id: existing.staffId }, data: { email } });
          if (existing.staff.userId) await tx.user.update({ where: { id: existing.staff.userId }, data: { email } });
        } else if (['residentialAddress', 'maritalStatus', 'emergencyContacts', 'nextOfKin', 'tin'].includes(field)) {
          const profileData: any = { [field]: value };
          await tx.employeeProfile.upsert({ where: { staffId: existing.staffId }, update: profileData, create: { staffId: existing.staffId, ...profileData } });
        } else if (['bankAccountNumber', 'bankName', 'bankSortCode', 'pfaName', 'rsaPin'].includes(field)) {
          if (!existing.staff.salaryStructure) throw new Error('Staff salary structure is not configured');
          const salaryField = field === 'pfaName' ? 'pensionFundAdmin' : field === 'rsaPin' ? 'pensionNumber' : field;
          const salaryData: any = { [salaryField]: String(value), bankVerifiedAt: null, bankVerificationReference: null };
          await tx.salaryStructure.update({ where: { staffId: existing.staffId }, data: salaryData });
        }
      }
      return tx.employeeChangeRequest.update({ where: { id: existing.id }, data: { status: body.status, reviewedBy: context.userId, reviewedAt: new Date(), reviewerNotes: String(body.reviewerNotes || '').trim() || null, effectiveAt: body.status === 'APPROVED' ? new Date() : null } });
    });
    await notifyEmployee({ organizationId: context.organizationId, propertyId: context.propertyId, staffId: existing.staffId, subject: `Profile change ${body.status.toLowerCase()}`, body: body.status === 'APPROVED' ? `Your ${existing.fieldName} change request was approved.` : body.status === 'REJECTED' ? `Your ${existing.fieldName} change request was rejected.${body.reviewerNotes ? ` Note: ${body.reviewerNotes}` : ''}` : `HR needs clarification on your ${existing.fieldName} change request.`, category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `profile-change:${existing.id}:${body.status}` });
    return NextResponse.json({ success: true, request });
  } catch (error) { return errorResponse(error); }
}
