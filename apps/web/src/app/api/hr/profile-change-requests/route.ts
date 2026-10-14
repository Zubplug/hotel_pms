import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

function errorResponse(error: any) {
  const message = String(error?.message || 'Profile change review failed');
  return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500 });
}

const GENERAL_MANAGER_ROLES = new Set(['GENERAL_MANAGER', 'SUPER_ADMIN', 'OWNER', 'ADMIN', 'CEO']);

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
    if (!GENERAL_MANAGER_ROLES.has(context.role)) return NextResponse.json({ error: 'Only the General Manager can approve employee profile changes' }, { status: 403 });
    const body = await req.json();
    if (!body.id || !['APPROVED', 'REJECTED', 'CLARIFICATION'].includes(body.status)) return NextResponse.json({ error: 'Request ID and valid review status are required' }, { status: 400 });
    const existing = await prisma.employeeChangeRequest.findFirst({ where: { id: body.id, staff: HrAuthorizationService.staffScope(context) }, include: { staff: { include: { employeeProfile: true, salaryStructure: true } } } });
    if (!existing) return NextResponse.json({ error: 'Profile change request not found' }, { status: 404 });
    if (existing.requestedBy === context.userId) return NextResponse.json({ error: 'The requester cannot approve their own employee profile change' }, { status: 403 });
    const request = await prisma.$transaction(async (tx) => {
      if (body.status === 'APPROVED') {
        let value: any = existing.proposedValue;
        try { value = JSON.parse(existing.proposedValue); } catch { /* scalar value */ }
        const field = existing.fieldName;
        if (field === 'staffProfile') {
          const staffData: any = {};
          if (value.firstName !== undefined) staffData.firstName = String(value.firstName).trim();
          if (value.lastName !== undefined) staffData.lastName = String(value.lastName).trim();
          if (value.email !== undefined) staffData.email = String(value.email).trim().toLowerCase();
          if (value.phone !== undefined) staffData.phone = String(value.phone || '').trim() || null;
          if (value.departmentName !== undefined) staffData.department = String(value.departmentName).trim();
          if (value.positionTitle !== undefined) staffData.position = String(value.positionTitle).trim();
          const updatedStaff = await tx.staff.update({ where: { id: existing.staffId }, data: staffData });
          if (value.email !== undefined && updatedStaff.userId) await tx.user.update({ where: { id: updatedStaff.userId }, data: { email: staffData.email } });

          const profileData: any = {};
          if (value.employmentType !== undefined) profileData.employmentType = value.employmentType;
          if (value.employmentStatus !== undefined) profileData.status = value.employmentStatus;
          if (value.nin !== undefined) profileData.nin = String(value.nin || '').trim() || null;
          if (value.bvn !== undefined) profileData.bvn = String(value.bvn || '').trim() || null;
          if (value.taxId !== undefined) profileData.tin = String(value.taxId || '').trim() || null;
          if (value.emergencyContact || value.emergencyPhone || value.emergencyRelation) profileData.emergencyContacts = [{ name: String(value.emergencyContact || '').trim(), phone: String(value.emergencyPhone || '').trim(), relationship: String(value.emergencyRelation || 'Emergency Contact').trim() }];
          await tx.employeeProfile.upsert({ where: { staffId: existing.staffId }, update: profileData, create: { staffId: existing.staffId, ...profileData } });

          const salaryFields = ['baseSalary', 'housingAllowance', 'transportAllowance', 'otherAllowances', 'bankName', 'bankAccountNumber', 'bankSortCode', 'bankAccountName', 'pfaName', 'rsaPin'].some((key) => value[key] !== undefined && value[key] !== '');
          if (salaryFields && existing.staff.salaryStructure) {
            await tx.salaryStructure.update({ where: { staffId: existing.staffId }, data: {
              ...(value.baseSalary !== undefined && value.baseSalary !== '' ? { basicSalary: Number(value.baseSalary) || 0 } : {}),
              ...(value.housingAllowance !== undefined && value.housingAllowance !== '' ? { housingAllowance: Number(value.housingAllowance) || 0 } : {}),
              ...(value.transportAllowance !== undefined && value.transportAllowance !== '' ? { transportAllowance: Number(value.transportAllowance) || 0 } : {}),
              ...(value.otherAllowances !== undefined && value.otherAllowances !== '' ? { otherAllowances: Number(value.otherAllowances) || 0 } : {}),
              ...(value.bankName !== undefined ? { bankName: String(value.bankName || '').trim() || null } : {}),
              ...(value.bankAccountNumber !== undefined ? { bankAccountNumber: String(value.bankAccountNumber || '').trim() || null } : {}),
              ...(value.bankSortCode !== undefined ? { bankSortCode: String(value.bankSortCode || '').trim() || null } : {}),
              ...(value.bankAccountName !== undefined ? { bankAccountName: String(value.bankAccountName || '').trim() || null } : {}),
              ...(value.pfaName !== undefined ? { pensionFundAdmin: String(value.pfaName || '').trim() || null } : {}),
              ...(value.rsaPin !== undefined ? { pensionNumber: String(value.rsaPin || '').trim() || null } : {}),
              bankVerifiedAt: null, bankVerificationReference: null,
            } });
          } else if (salaryFields) {
            await tx.salaryStructure.create({ data: {
              organizationId: existing.staff.organizationId,
              propertyId: existing.staff.propertyAccess[0],
              staffId: existing.staffId,
              basicSalary: Number(value.baseSalary) || 0,
              housingAllowance: Number(value.housingAllowance) || 0,
              transportAllowance: Number(value.transportAllowance) || 0,
              otherAllowances: Number(value.otherAllowances) || 0,
              bankName: value.bankName ? String(value.bankName).trim() : null,
              bankAccountNumber: value.bankAccountNumber ? String(value.bankAccountNumber).trim() : null,
              bankSortCode: value.bankSortCode ? String(value.bankSortCode).trim() : null,
              bankAccountName: value.bankAccountName ? String(value.bankAccountName).trim() : null,
              pensionFundAdmin: value.pfaName ? String(value.pfaName).trim() : null,
              pensionNumber: value.rsaPin ? String(value.rsaPin).trim() : null,
              effectiveFrom: new Date(),
              createdBy: context.userId,
            } });
          }
        } else if (field === 'phone') await tx.staff.update({ where: { id: existing.staffId }, data: { phone: String(value) } });
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
