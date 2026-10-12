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

    const tasks = await prisma.onboardingTask.findMany({
      where: {
        staff: staffWhere,
      },
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: true,
            position: true,
          },
        },
      },
      orderBy: [{ isCompleted: 'asc' }, { dueDate: 'asc' }],
    });

    const formattedTasks = tasks.map((t) => ({
      id: t.id,
      staffId: t.staffId,
      staffName: `${t.staff.firstName || ''} ${t.staff.lastName || ''}`.trim(),
      department: t.staff.department || 'General',
      position: t.staff.position || 'Staff',
      title: t.title,
      description: t.description,
      category: t.category,
      isCompleted: t.isCompleted,
      completedAt: t.completedAt,
      dueDate: t.dueDate,
    }));

    return NextResponse.json({ tasks: formattedTasks });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get onboarding tasks:', error);
    return NextResponse.json({ error: 'Failed to retrieve tasks' }, { status: 500 });
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

    if (action === 'TOGGLE_TASK') {
      const { taskId, isCompleted } = body;
      if (!taskId) {
        return NextResponse.json({ error: 'Task ID required' }, { status: 400 });
      }

      // Verify task belongs to this tenant
      const existingTask = await prisma.onboardingTask.findFirst({
        where: {
          id: taskId,
          staff: {
            organizationId,
            ...(propertyId ? { propertyAccess: { has: propertyId } } : {}),
            ...(authContext.role === 'DEPARTMENT_HEAD' && authContext.department ? { department: authContext.department } : {}),
          },
        },
      });

      if (!existingTask) {
        return NextResponse.json({ error: 'Onboarding task not found or unauthorized' }, { status: 404 });
      }

      const updated = await prisma.onboardingTask.update({
        where: { id: taskId },
        data: {
          isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'CREATE_CHECKLIST') {
      const { staffId } = body;
      if (!staffId) return NextResponse.json({ error: 'Staff ID is required' }, { status: 400 });

      // Verify staff belongs to tenant and property
      const targetStaff = await prisma.staff.findFirst({
        where: {
          id: staffId,
          organizationId,
        ...(propertyId ? { propertyAccess: { has: propertyId } } : {}),
        ...(authContext.role === 'DEPARTMENT_HEAD' && authContext.department ? { department: authContext.department } : {}),
        },
      });

      if (!targetStaff) {
        return NextResponse.json({ error: 'Staff member not found or inaccessible in property' }, { status: 404 });
      }

      const standardTasks = [
        { title: 'Submit NIN, BVN & State Tax ID', category: 'COMPLIANCE', description: 'Statutory identity verification' },
        { title: 'Sign Employment Contract & Handbook', category: 'LEGAL', description: 'Policy agreement and offer letter' },
        { title: 'Hotel Uniform & Name Badge Issuance', category: 'OPERATIONS', description: 'LodgeCore front-of-house attire' },
        { title: 'Food Handler Health Check & Certificate', category: 'COMPLIANCE', description: 'Mandatory hospitality hygiene exam' },
        { title: 'LodgeCore POS & PMS Credentials Setup', category: 'IT', description: 'System role, POS PIN, and outlet assignment' },
        { title: 'Emergency Contact & Bank Details Verification', category: 'PAYROLL', description: 'Disbursement and next-of-kin file' },
      ];

      const created = await prisma.onboardingTask.createMany({
        data: standardTasks.map((t) => ({
          staffId,
          title: t.title,
          category: t.category,
          description: t.description,
          isCompleted: false,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
        })),
      });

      return NextResponse.json({ success: true, count: created.count }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to update onboarding task:', error);
    return NextResponse.json({ error: 'Failed to process task request' }, { status: 500 });
  }
}
