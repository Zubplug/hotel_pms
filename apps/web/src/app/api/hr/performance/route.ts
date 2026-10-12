import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.view');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    const staffWhere: any = { organizationId };
    if (propertyId) {
      staffWhere.propertyAccess = { has: propertyId };
    }
    if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) {
      staffWhere.department = authContext.department;
    }

    const [appraisals, trainings, disciplinaries] = await Promise.all([
      prisma.performanceAppraisal.findMany({
        where: { staff: staffWhere },
        include: {
          staff: {
            select: { id: true, firstName: true, lastName: true, department: true, position: true },
          },
        },
        orderBy: { periodEnd: 'desc' },
      }),
      prisma.trainingRecord.findMany({
        where: { staff: staffWhere },
        include: {
          staff: {
            select: { id: true, firstName: true, lastName: true, department: true, position: true },
          },
        },
        orderBy: { completedAt: 'desc' },
      }),
      prisma.disciplinaryRecord.findMany({
        where: {
          staff: staffWhere,
          ...(authContext.canViewSensitive ? {} : { isConfidential: false }),
        },
        include: {
          staff: {
            select: { id: true, firstName: true, lastName: true, department: true, position: true },
          },
        },
        orderBy: { incidentDate: 'desc' },
      }),
    ]);

    return NextResponse.json({
      appraisals: appraisals.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        staffName: `${a.staff.firstName || ''} ${a.staff.lastName || ''}`.trim(),
        department: a.staff.department,
        position: a.staff.position,
        reviewPeriodStart: a.periodStart,
        reviewPeriodEnd: a.periodEnd,
        overallScore: Number(a.managerScore || a.selfScore || 0),
        status: a.status,
        reviewerNotes: a.developmentPlan,
      })),
      trainings: trainings.map((t) => ({
        id: t.id,
        staffId: t.staffId,
        staffName: `${t.staff.firstName || ''} ${t.staff.lastName || ''}`.trim(),
        courseName: t.courseTitle,
        provider: t.provider,
        startDate: t.completedAt,
        endDate: t.expiresAt,
        status: 'COMPLETED',
        score: Number(t.score || 0),
      })),
      disciplinaries: disciplinaries.map((d) => ({
        id: d.id,
        staffId: d.staffId,
        staffName: `${d.staff.firstName || ''} ${d.staff.lastName || ''}`.trim(),
        incidentDate: d.incidentDate,
        category: d.type,
        description: d.description,
        actionTaken: d.actionTaken,
        status: 'LOGGED',
      })),
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get performance & records:', error);
    return NextResponse.json({ error: 'Failed to retrieve performance data' }, { status: 500 });
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

    // Helper to validate staff tenant boundary
    const validateStaff = async (staffId: string) => {
      return await prisma.staff.findFirst({
        where: {
          id: staffId,
          organizationId,
          ...(propertyId ? { propertyAccess: { has: propertyId } } : {}),
          ...(authContext.role === 'DEPARTMENT_HEAD' && authContext.department ? { department: authContext.department } : {}),
        },
      });
    };

    if (action === 'CREATE_APPRAISAL') {
      const { staffId, reviewPeriodStart, reviewPeriodEnd, overallScore = 3.5, reviewerNotes } = body;
      if (!staffId) return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });

      const staff = await validateStaff(staffId);
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or unauthorized' }, { status: 404 });
      }

      const reviewer = await prisma.staff.findFirst({
        where: { userId: authContext.userId, organizationId: authContext.organizationId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      if (!reviewer) {
        return NextResponse.json({ error: 'The current user is not linked to an active staff record and cannot be recorded as reviewer' }, { status: 403 });
      }

      const appraisal = await prisma.performanceAppraisal.create({
        data: {
          propertyId,
          staffId,
          reviewerId: reviewer.id,
          cycleName: `Review ${new Date().getFullYear()}`,
          periodStart: new Date(reviewPeriodStart),
          periodEnd: new Date(reviewPeriodEnd),
          managerScore: Number(overallScore),
          kpis: [{ kpi: 'Core Competency', score: Number(overallScore) }],
          developmentPlan: reviewerNotes?.trim() || 'Annual performance evaluation',
          status: 'REVIEWED',
        },
      });
      return NextResponse.json({ success: true, data: appraisal }, { status: 201 });
    }

    if (action === 'CREATE_TRAINING') {
      const { staffId, courseName, provider, startDate, score } = body;
      if (!staffId) return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });

      const staff = await validateStaff(staffId);
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or unauthorized' }, { status: 404 });
      }

      const training = await prisma.trainingRecord.create({
        data: {
          propertyId,
          staffId,
          courseTitle: courseName.trim(),
          provider: provider?.trim() || null,
          completedAt: new Date(startDate || Date.now()),
          score: score ? Number(score) : null,
        },
      });
      return NextResponse.json({ success: true, data: training }, { status: 201 });
    }

    if (action === 'CREATE_DISCIPLINARY') {
      HrAuthorizationService.assertPermission(authContext, 'hr.employee.sensitive.view');
      const { staffId, incidentDate, category = 'ATTENDANCE', description, actionTaken } = body;
      if (!staffId) return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });

      const staff = await validateStaff(staffId);
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or unauthorized' }, { status: 404 });
      }

      const record = await prisma.disciplinaryRecord.create({
        data: {
          propertyId,
          staffId,
          incidentDate: new Date(incidentDate),
          type: category,
          subject: category,
          description: description.trim(),
          actionTaken: actionTaken?.trim() || 'Verbal Warning',
          issuedByUserId: authContext.userId,
        },
      });
      return NextResponse.json({ success: true, data: record }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid performance action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Performance action failed:', error);
    return NextResponse.json({ error: 'Failed to process request' }, { status: 500 });
  }
}
