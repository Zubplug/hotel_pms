import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

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
        title: v.title,
        department: v.requisition.position.department?.name || 'General',
        positionsCount: 1,
        status: v.status,
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
      const requisition = await prisma.jobRequisition.create({
        data: {
          propertyId,
          departmentId: dept.id,
          positionId: pos.id,
          justification: description?.trim() || `Hiring for ${title.trim()}`,
          openings: 1,
        },
      });

      const vacancy = await prisma.jobVacancy.create({
        data: {
          requisitionId: requisition.id,
          title: title.trim(),
          description: description?.trim() || `Role: ${title.trim()}`,
          requirements: description.trim(),
          closingDate: closingDate ? new Date(closingDate) : null,
          status: 'OPEN',
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
          requisition: {
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

      // Validate applicant belongs to tenant
      const applicant = await prisma.jobApplicant.findFirst({
        where: {
          id: applicantId,
          vacancy: {
            requisition: {
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

    if (action === 'CONVERT_TO_EMPLOYEE') {
      if (!propertyId) return NextResponse.json({ error: 'Property context is required' }, { status: 400 });
      const applicantId = body.applicantId;
      if (!applicantId) return NextResponse.json({ error: 'Applicant ID is required' }, { status: 400 });
      const applicant = await prisma.jobApplicant.findFirst({
        where: { id: applicantId, stage: { in: ['OFFER', 'HIRED'] }, vacancy: { requisition: { propertyId, property: { organizationId } } } },
        include: { vacancy: { include: { requisition: { include: { position: { include: { department: true } } } } } } },
      });
      if (!applicant) return NextResponse.json({ error: 'Applicant must be at OFFER or HIRED stage and belong to the selected property' }, { status: 404 });
      if (applicant.convertedStaffId) return NextResponse.json({ error: 'Applicant has already been converted', staffId: applicant.convertedStaffId }, { status: 409 });
      const [firstName, ...lastParts] = applicant.fullName.trim().split(/\s+/);
      const lastName = lastParts.join(' ') || firstName;
      const offer = (applicant.offerDetails || {}) as Record<string, unknown>;
      const baseSalary = Number(body.baseSalary ?? offer.basicSalary ?? 0);
      if (!Number.isFinite(baseSalary) || baseSalary <= 0) return NextResponse.json({ error: 'A positive base salary is required for conversion' }, { status: 400 });
      const result = await prisma.$transaction(async (tx) => {
        const existing = await tx.staff.findFirst({ where: { organizationId, email: applicant.email } });
        if (existing) throw new Error('CONFLICT: An employee already uses this applicant email');
        const staff = await tx.staff.create({ data: { organizationId, employeeId: `EMP-${applicant.id.replace(/-/g, '').slice(0, 12).toUpperCase()}`, email: applicant.email, firstName, lastName, phone: applicant.phone || null, department: applicant.vacancy.requisition.position.department.name, position: applicant.vacancy.title, propertyAccess: [propertyId], isActive: true, hiredAt: body.hireDate ? new Date(body.hireDate) : new Date() } });
        await tx.employeeProfile.create({ data: { staffId: staff.id, employmentType: String(body.employmentType || applicant.vacancy.requisition.employmentType || 'PERMANENT'), status: 'ACTIVE' } });
        const salaryData = { staffId: staff.id, organizationId, propertyId, basicSalary: baseSalary, housingAllowance: Number(body.housingAllowance || offer.housingAllowance || 0), transportAllowance: Number(body.transportAllowance || offer.transportAllowance || 0), otherAllowances: Number(body.otherAllowances || offer.otherAllowances || 0), effectiveFrom: body.hireDate ? new Date(body.hireDate) : new Date(), createdBy: authContext.userId };
        await tx.salaryStructure.create({ data: salaryData });
        await tx.salaryStructureVersion.create({ data: salaryData });
        await tx.jobApplicant.update({ where: { id: applicant.id }, data: { stage: 'HIRED', convertedStaffId: staff.id } });
        return staff;
      });
      return NextResponse.json({ success: true, staff: result }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid recruitment action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Recruitment operation error:', error);
    return NextResponse.json({ error: 'Recruitment action failed' }, { status: 500 });
  }
}
