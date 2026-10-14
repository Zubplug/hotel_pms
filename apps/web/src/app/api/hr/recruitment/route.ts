import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { hash } from 'bcryptjs';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { sendEmployeeInvitationEmail } from '@/lib/email/send-employee-invitation';

const GM_ROLES = new Set(['GENERAL_MANAGER', 'HOTEL_MANAGER', 'CEO', 'ADMIN', 'SUPER_ADMIN', 'OWNER']);

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.view');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    const requisitionWhere: any = {};
    if (organizationId) {
      requisitionWhere.property = { organizationId };
    }
    if (propertyId) {
      requisitionWhere.propertyId = propertyId;
    }

    const [vacancies, applicants] = await Promise.all([
      prisma.jobVacancy.findMany({
        where: { requisition: requisitionWhere },
        include: {
          requisition: {
            select: {
              propertyId: true,
              departmentId: true,
              status: true,
              approvedBy: true,
              position: { select: { department: { select: { name: true } } } },
            },
          },
          applicants: { select: { id: true, stage: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.jobApplicant.findMany({
        where: { vacancy: { requisition: requisitionWhere } },
        include: {
          vacancy: {
            select: {
              id: true,
              title: true,
              requisition: { select: { propertyId: true, position: { select: { department: { select: { name: true } } } } } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    return NextResponse.json({
      vacancies: vacancies.map((v) => ({
        id: v.id,
        requisitionId: v.requisitionId,
        title: v.title,
        department: v.requisition.position.department?.name || 'General',
        positionsCount: 1,
        status: v.status,
        requisitionStatus: v.requisition.status,
        requisitionApprovedBy: v.requisition.approvedBy,
        applicantsCount: v.applicants.length,
        closingDate: v.closingDate,
      })),
      applicants: applicants.map((a) => ({
        id: a.id,
        vacancyId: a.vacancyId,
        vacancyTitle: a.vacancy.title,
        department: a.vacancy.requisition.position.department?.name || 'General',
        fullName: a.fullName,
        email: a.email,
        phone: a.phone,
        stage: a.stage,
        rating: a.rating,
        notes: a.interviewNotes,
        createdAt: a.createdAt,
      })),
      role: authContext.role,
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get recruitment data:', error);
    return NextResponse.json({ error: 'Failed to retrieve recruitment data' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.manage');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;
    const body = await req.json();
    const { action } = body;

    if (action === 'CREATE_VACANCY') {
      const { title, departmentId, description, closingDate } = body;
      if (!title || !description?.trim()) return NextResponse.json({ error: 'Title and a real job description are required' }, { status: 400 });

      if (!propertyId) {
        return NextResponse.json({ error: 'Property ID context required' }, { status: 400 });
      }

      // Find or create a department for requisition within current property
      let dept = departmentId
        ? await prisma.department.findFirst({ where: { id: departmentId, propertyId } })
        : null;
      if (!dept) {
        dept = await prisma.department.findFirst({ where: { propertyId } });
      }

      // Find or create position
      let pos = dept ? await prisma.jobPosition.findFirst({ where: { departmentId: dept.id, propertyId } }) : null;
      if (!pos && dept) {
        pos = await prisma.jobPosition.create({
          data: {
            propertyId,
            departmentId: dept.id,
            title: title.trim(),
            code: title.slice(0, 4).toUpperCase(),
          },
        });
      }

      if (!dept || !pos) {
        return NextResponse.json({ error: 'Valid department and position required' }, { status: 400 });
      }

      // Create JobRequisition
      const openings = Math.max(1, Math.min(100, Number(body.positionsCount) || 1));
      const requisition = await prisma.jobRequisition.create({
        data: {
          propertyId,
          departmentId: dept.id,
          positionId: pos.id,
          justification: description?.trim() || `Hiring for ${title.trim()}`,
          openings,
          status: 'PENDING_APPROVAL',
          createdBy: authContext.userId,
        },
      });

      const vacancy = await prisma.jobVacancy.create({
        data: {
          requisitionId: requisition.id,
          title: title.trim(),
          description: description?.trim() || `Role: ${title.trim()}`,
          requirements: description.trim(),
          closingDate: closingDate ? new Date(closingDate) : null,
          status: 'PAUSED',
        },
      });
      return NextResponse.json({ success: true, data: vacancy }, { status: 201 });
    }

    if (action === 'CREATE_APPLICANT') {
      const { vacancyId, fullName, email, phone, notes } = body;
      if (!vacancyId || !fullName || !email) {
        return NextResponse.json({ error: 'Vacancy ID, full name, and email are required' }, { status: 400 });
      }

      // Validate vacancy belongs to tenant
      const vacancy = await prisma.jobVacancy.findFirst({
        where: {
          id: vacancyId,
          status: 'OPEN',
          requisition: {
            status: 'APPROVED',
            propertyId,
            ...(organizationId ? { property: { organizationId } } : {}),
          },
        },
      });
      if (!vacancy) {
        return NextResponse.json({ error: 'Vacancy not found or inaccessible' }, { status: 404 });
      }

      const applicant = await prisma.jobApplicant.create({
        data: {
          vacancyId,
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone?.trim() || '',
          interviewNotes: notes?.trim() || null,
          stage: 'APPLIED',
        },
      });
      return NextResponse.json({ success: true, data: applicant }, { status: 201 });
    }

    if (action === 'UPDATE_STAGE') {
      const { applicantId, stage, rating, notes } = body;
      if (!applicantId) {
        return NextResponse.json({ error: 'Applicant ID is required' }, { status: 400 });
      }
      const allowedStages = new Set(['APPLIED', 'SCREENING', 'INTERVIEW', 'ASSESSMENT', 'OFFER', 'HIRED', 'REJECTED']);
      if (!allowedStages.has(String(stage))) return NextResponse.json({ error: 'Invalid applicant stage' }, { status: 400 });

      // Validate applicant belongs to tenant
      const applicant = await prisma.jobApplicant.findFirst({
        where: {
          id: applicantId,
          vacancy: {
            status: 'OPEN',
            requisition: {
              status: 'APPROVED',
              propertyId,
              ...(organizationId ? { property: { organizationId } } : {}),
            },
          },
        },
      });
      if (!applicant) {
        return NextResponse.json({ error: 'Applicant not found or inaccessible' }, { status: 404 });
      }

      const updated = await prisma.jobApplicant.update({
        where: { id: applicantId },
        data: {
          stage,
          ...(rating !== undefined ? { rating: Number(rating) } : {}),
          ...(notes ? { interviewNotes: notes } : {}),
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'APPROVE_REQUISITION' || action === 'REJECT_REQUISITION') {
      if (!GM_ROLES.has(authContext.role)) return NextResponse.json({ error: 'Only an independent General Manager or authorized executive may approve hiring requisitions' }, { status: 403 });
      const requisitionId = String(body.requisitionId || '');
      if (!requisitionId) return NextResponse.json({ error: 'Requisition ID is required' }, { status: 400 });
      const requisition = await prisma.jobRequisition.findFirst({ where: { id: requisitionId, propertyId, property: { organizationId } }, include: { vacancies: true } });
      if (!requisition) return NextResponse.json({ error: 'Hiring requisition not found' }, { status: 404 });
      if (requisition.status !== 'PENDING_APPROVAL') return NextResponse.json({ error: `Requisition is already ${requisition.status.toLowerCase()}` }, { status: 409 });
      if (requisition.createdBy === authContext.userId) return NextResponse.json({ error: 'Maker-checker violation: the requisition creator cannot approve their own hiring request' }, { status: 403 });
      const approved = action === 'APPROVE_REQUISITION';
      const updated = await prisma.$transaction(async (tx) => {
        const next = await tx.jobRequisition.update({ where: { id: requisition.id }, data: approved ? { status: 'APPROVED', approvedBy: authContext.userId, approvedAt: new Date(), rejectionReason: null } : { status: 'REJECTED', rejectionReason: String(body.reason || '').trim() || 'Requisition was not approved' } });
        await tx.jobVacancy.updateMany({ where: { requisitionId: requisition.id }, data: { status: approved ? 'OPEN' : 'CLOSED' } });
        await tx.auditLog.create({ data: { organizationId, propertyId, userId: authContext.userId, action: approved ? 'HR_REQUISITION_APPROVED' : 'HR_REQUISITION_REJECTED', resource: 'JobRequisition', resourceId: requisition.id, requestId: randomUUID(), newValue: { status: next.status, reason: body.reason || null } } });
        return next;
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'CONVERT_TO_EMPLOYEE') {
      if (!propertyId) return NextResponse.json({ error: 'Property context is required' }, { status: 400 });
      const applicantId = body.applicantId;
      if (!applicantId) return NextResponse.json({ error: 'Applicant ID is required' }, { status: 400 });
      const applicant = await prisma.jobApplicant.findFirst({
        where: { id: applicantId, stage: { in: ['OFFER', 'HIRED'] }, vacancy: { requisition: { propertyId, status: 'APPROVED', property: { organizationId } } } },
        include: { vacancy: { include: { requisition: { include: { position: { include: { department: true } } } } } } },
      });
      if (!applicant) return NextResponse.json({ error: 'Applicant must be at OFFER or HIRED stage and belong to the selected property' }, { status: 404 });
      if (applicant.convertedStaffId) return NextResponse.json({ error: 'Applicant has already been converted', staffId: applicant.convertedStaffId }, { status: 409 });
      const [firstName, ...lastParts] = applicant.fullName.trim().split(/\s+/);
      const lastName = lastParts.join(' ') || firstName;
      const offer = (applicant.offerDetails || {}) as Record<string, unknown>;
      const baseSalary = Number(body.baseSalary ?? offer.basicSalary ?? 0);
      if (!Number.isFinite(baseSalary) || baseSalary <= 0) return NextResponse.json({ error: 'A positive base salary is required for conversion' }, { status: 400 });
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const invitationExpiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000);
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.staff.findFirst({ where: { organizationId, email: applicant.email } });
        if (existing) throw new Error('CONFLICT: An employee already uses this applicant email');
        const passwordHash = await hash(randomBytes(32).toString('hex'), 12);
        const normalizedEmail = applicant.email.trim().toLowerCase();
        const existingUser = await tx.user.findUnique({ where: { email: normalizedEmail } });
        if (existingUser?.staffId) throw new Error('CONFLICT: An employee account already uses this applicant email');
        const user = existingUser
          ? await tx.user.update({ where: { id: existingUser.id }, data: { passwordHash } })
          : await tx.user.create({ data: { email: normalizedEmail, passwordHash } });
        const staff = await tx.staff.create({ data: { organizationId, userId: user.id, employeeId: `EMP-${applicant.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`, email: applicant.email, firstName, lastName, phone: applicant.phone || null, department: applicant.vacancy.requisition.position.department.name, position: applicant.vacancy.title, propertyAccess: [propertyId], isActive: true, hiredAt: body.hireDate ? new Date(body.hireDate) : new Date() } });
        await tx.user.update({ where: { id: user.id }, data: { staffId: staff.id } });
        await tx.organizationMembership.create({ data: { userId: user.id, organizationId, status: 'ACTIVE', role: 'MEMBER' } });
        await tx.employeeInvitation.create({ data: { staffId: staff.id, userId: user.id, organizationId, tokenHash, expiresAt: invitationExpiresAt, invitedById: authContext.userId } });
        await tx.employeeProfile.create({ data: { staffId: staff.id, employmentType: String(body.employmentType || applicant.vacancy.requisition.employmentType || 'PERMANENT'), status: 'ACTIVE' } });
        const salaryData = { staffId: staff.id, organizationId, propertyId, basicSalary: baseSalary, housingAllowance: Number(body.housingAllowance || offer.housingAllowance || 0), transportAllowance: Number(body.transportAllowance || offer.transportAllowance || 0), otherAllowances: Number(body.otherAllowances || offer.otherAllowances || 0), effectiveFrom: body.hireDate ? new Date(body.hireDate) : new Date(), createdBy: authContext.userId };
        await tx.salaryStructure.create({ data: salaryData });
        await tx.salaryStructureVersion.create({ data: salaryData });
        await tx.jobApplicant.update({ where: { id: applicant.id }, data: { stage: 'HIRED', convertedStaffId: staff.id } });
        const organization = await tx.organization.findUnique({ where: { id: organizationId }, select: { name: true } });
        return { staff, organizationName: organization?.name || 'LodgeCore' };
      });
      let invitationSent = true;
      let invitationWarning: string | undefined;
      try {
        await sendEmployeeInvitationEmail({ to: result.staff.email, inviteUrl: `${req.nextUrl.origin}/employee/invite/${rawToken}`, expiresAt: invitationExpiresAt, employeeName: `${result.staff.firstName} ${result.staff.lastName}`.trim(), organizationName: result.organizationName });
      } catch (emailError) {
        invitationSent = false;
        invitationWarning = emailError instanceof Error ? emailError.message : 'Unable to send activation email';
        console.error('Recruitment employee activation email failed:', emailError);
      }
      return NextResponse.json({ success: true, staff: result.staff, invitationSent, invitationExpiresAt, invitationWarning }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid recruitment action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Recruitment operation error:', error);
    if (error.message?.includes('CONFLICT')) return NextResponse.json({ error: error.message.replace(/^CONFLICT:\s*/, '') }, { status: 409 });
    return NextResponse.json({ error: 'Recruitment action failed' }, { status: 500 });
  }
}
