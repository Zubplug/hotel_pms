import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const canManageLeave = HrAuthorizationService.can(authContext, 'hr.employee.view') || HrAuthorizationService.can(authContext, 'hr.leave.manage');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    const whereProperty: any = {};
    if (organizationId) whereProperty.organizationId = organizationId;
    if (propertyId) whereProperty.id = propertyId;

    // 1. Fetch Leave Types scoped to tenant
    const leaveTypes = await prisma.leaveType.findMany({
      where: {
        property: whereProperty,
        isActive: true,
      },
      orderBy: { name: 'asc' },
    });

    const whereStaff: any = {};
    if (organizationId) whereStaff.organizationId = organizationId;
    if (propertyId) whereStaff.propertyAccess = { has: propertyId };

    // Enforce department boundary for Department Heads
    if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) {
      whereStaff.department = authContext.department;
    }

    // Ordinary employees may read only their own leave records and balances.
    if (!canManageLeave) whereStaff.userId = authContext.userId;

    // 2. Fetch Applications scoped to tenant
    const applications = await prisma.leaveApplication.findMany({
      where: {
        staff: whereStaff,
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
        leaveType: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    // 3. Fetch Allocations/Balances scoped to tenant
    const allocations = await prisma.leaveAllocation.findMany({
      where: {
        staff: whereStaff,
      },
      include: {
        staff: {
          select: { id: true, firstName: true, lastName: true },
        },
        leaveType: true,
      },
    });

    return NextResponse.json({
      leaveTypes: leaveTypes.map((lt) => ({
        id: lt.id,
        name: lt.name,
        code: lt.code,
        daysPerYear: lt.defaultDays,
        isPaid: lt.isPaid,
        carryForwardLimit: lt.carryOverMaxDays,
      })),
      applications: applications.map((a) => ({
        id: a.id,
        staffId: a.staffId,
        staffName: `${a.staff.firstName || ''} ${a.staff.lastName || ''}`.trim(),
        department: a.staff.department || 'General',
        position: a.staff.position || 'Staff',
        leaveTypeId: a.leaveTypeId,
        leaveTypeName: a.leaveType.name,
        startDate: a.startDate,
        endDate: a.endDate,
        daysRequested: a.totalDays,
        reason: a.reason,
        status: a.status,
        reliefStaffId: a.handoverStaffId,
        rejectionReason: a.rejectionReason,
        createdAt: a.createdAt,
      })),
      allocations: allocations.map((al) => ({
        id: al.id,
        staffId: al.staffId,
        staffName: `${al.staff.firstName || ''} ${al.staff.lastName || ''}`.trim(),
        leaveTypeName: al.leaveType.name,
        year: al.year,
        allocatedDays: al.entitledDays,
        usedDays: al.usedDays,
        pendingDays: al.pendingDays,
        remainingDays: al.balanceDays,
      })),
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get leave data:', error);
    return NextResponse.json({ error: 'Failed to retrieve leave records' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const body = await req.json();
    const { action } = body;

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    if (action === 'APPLY_LEAVE') {
      const { staffId, leaveTypeId, startDate, endDate, reason, reliefStaffId } = body;
      if (!staffId || !leaveTypeId || !startDate || !endDate) {
        return NextResponse.json({ error: 'Missing required leave fields' }, { status: 400 });
      }

      // Verify staff belongs to tenant
      const staff = await prisma.staff.findFirst({
        where: { ...HrAuthorizationService.staffScope(authContext, { id: staffId }), deletedAt: null },
      });
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
      }

      if (staff.userId !== authContext.userId && !HrAuthorizationService.can(authContext, 'hr.leave.manage')) {
        return NextResponse.json({ error: 'Forbidden: Employees may only submit leave for themselves' }, { status: 403 });
      }

      // Target property must be valid
      const targetPropertyId = propertyId || staff.propertyAccess[0];
      if (!targetPropertyId) {
        return NextResponse.json({ error: 'Staff has no associated property' }, { status: 400 });
      }

      const leaveType = await prisma.leaveType.findFirst({
        where: { id: leaveTypeId, propertyId: targetPropertyId, isActive: true },
      });
      if (!leaveType) {
        return NextResponse.json({ error: 'Leave type is not available in the selected property' }, { status: 404 });
      }

      const start = new Date(startDate);
      const end = new Date(endDate);
      if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
        return NextResponse.json({ error: 'Leave end date must be on or after the start date' }, { status: 400 });
      }
      const startDay = Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate());
      const endDay = Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate());
      const requestedDays = Math.floor((endDay - startDay) / 86400000) + 1;
      if (!Number.isInteger(requestedDays) || requestedDays < 1) return NextResponse.json({ error: 'Leave dates are invalid' }, { status: 400 });
      const overlap = await prisma.leaveApplication.findFirst({
        where: {
          staffId,
          propertyId: targetPropertyId,
          status: { in: ['PENDING_HOD', 'PENDING_HR', 'APPROVED'] },
          startDate: { lte: end },
          endDate: { gte: start },
        },
        select: { id: true },
      });
      if (overlap) return NextResponse.json({ error: 'An existing pending or approved leave overlaps these dates' }, { status: 409 });

      const application = await prisma.leaveApplication.create({
        data: {
          propertyId: targetPropertyId,
          staffId,
          leaveTypeId,
          startDate: start,
          endDate: end,
          totalDays: requestedDays,
          reason: reason?.trim() || 'Leave request',
          handoverStaffId: reliefStaffId || null,
          status: 'PENDING_HOD',
        },
      });
      const allocation = await prisma.leaveAllocation.findUnique({ where: { staffId_leaveTypeId_year: { staffId, leaveTypeId, year: start.getUTCFullYear() } } });
      if (allocation) {
        if (allocation.balanceDays - allocation.pendingDays < requestedDays) {
          await prisma.leaveApplication.delete({ where: { id: application.id } });
          return NextResponse.json({ error: `Insufficient leave balance: only ${allocation.balanceDays - allocation.pendingDays} days are available` }, { status: 422 });
        }
        await prisma.leaveAllocation.update({ where: { id: allocation.id }, data: { pendingDays: { increment: requestedDays } } });
      }
      await notifyEmployee({ organizationId, propertyId: targetPropertyId, staffId, subject: 'Leave request submitted', body: 'Your leave request has been submitted and is awaiting department approval.', category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `leave:${application.id}:submitted` });
      return NextResponse.json({ success: true, data: application }, { status: 201 });
    }

    if (action === 'PROCESS_APPLICATION') {
      const canProcessLeave = HrAuthorizationService.can(authContext, 'hr.leave.manage') || ['DEPARTMENT_HEAD', 'GENERAL_MANAGER', 'SUPER_ADMIN', 'OWNER', 'ADMIN', 'HR_MANAGER'].includes(authContext.role);
      if (!canProcessLeave) HrAuthorizationService.assertPermission(authContext, 'hr.leave.manage');

      const { applicationId, status, rejectionReason } = body;
      if (!applicationId || !status) {
        return NextResponse.json({ error: 'applicationId and status are required' }, { status: 400 });
      }

      const isApproved = status === 'APPROVED';

      const result = await prisma.$transaction(async (tx: any) => {
        // Find existing application and check tenant scoping
        const app = await tx.leaveApplication.findFirst({
          where: {
            id: applicationId,
            staff: HrAuthorizationService.staffScope(authContext),
            propertyId,
          },
          include: {
            staff: true,
            leaveType: true,
          },
        });

        if (!app) {
          throw new Error('Leave application not found or inaccessible');
        }

        // Enforce department boundary for Department Heads
        if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) {
          if (app.staff.department !== authContext.department) {
            throw new Error(
              `Forbidden: Department Head can only process leave for staff in department [${authContext.department}]`
            );
          }
        }

        // Prevent repeated processing/decrement if already finalized
        if (app.status === 'APPROVED' || app.status === 'REJECTED') {
          throw new Error(`Cannot re-process an already ${app.status.toLowerCase()} application`);
        }

        const year = new Date(app.startDate).getFullYear();

        const isHodStage = app.status === 'PENDING_HOD';
        if (isHodStage && isApproved && !['DEPARTMENT_HEAD', 'GENERAL_MANAGER', 'SUPER_ADMIN', 'OWNER', 'ADMIN', 'HR_MANAGER'].includes(authContext.role)) {
          throw new Error('Only the department head or HR management can approve this leave stage');
        }
        if (isHodStage && !isApproved && authContext.role === 'DEPARTMENT_HEAD') {
          // Department heads may reject at their approval stage.
        }

        if (isApproved && !isHodStage) {
          // Check leave balance before approving
          const allocation = await tx.leaveAllocation.findFirst({
            where: {
              staffId: app.staffId,
              leaveTypeId: app.leaveTypeId,
              year,
            },
          });

          if (allocation && allocation.balanceDays - allocation.pendingDays < app.totalDays) {
            throw new Error(`Insufficient leave balance: Requested ${app.totalDays} days, but only ${allocation.balanceDays} days remain`);
          }

          // Decrement balance
          if (allocation) {
            await tx.leaveAllocation.update({
              where: { id: allocation.id },
              data: {
                pendingDays: { decrement: app.totalDays },
                usedDays: { increment: app.totalDays },
                balanceDays: { decrement: app.totalDays },
              },
            });
          }
        } else if (!isApproved) {
          const allocation = await tx.leaveAllocation.findUnique({ where: { staffId_leaveTypeId_year: { staffId: app.staffId, leaveTypeId: app.leaveTypeId, year } } });
          if (allocation && allocation.pendingDays > 0) {
            await tx.leaveAllocation.update({ where: { id: allocation.id }, data: { pendingDays: { decrement: Math.min(allocation.pendingDays, app.totalDays) } } });
          }
        }

        const updated = await tx.leaveApplication.update({
          where: { id: applicationId },
          data: {
            status: isApproved && isHodStage ? 'PENDING_HR' : status,
            hodApprovedAt: isApproved && isHodStage ? new Date() : app.hodApprovedAt,
            hodUserId: isApproved && isHodStage ? authContext.userId : app.hodUserId,
            rejectionReason: rejectionReason?.trim() || null,
            hrUserId: isApproved && !isHodStage ? authContext.userId : app.hrUserId,
            hrApprovedAt: isApproved && !isHodStage ? new Date() : app.hrApprovedAt,
          },
        });

        return updated;
      });

      await notifyEmployee({ organizationId, propertyId, staffId: result.staffId, subject: `Leave request ${result.status.toLowerCase().replace('_', ' ')}`, body: result.status === 'PENDING_HR' ? 'Your department approved the leave request. It is now awaiting HR confirmation.' : result.status === 'APPROVED' ? 'Your leave request has been approved.' : `Your leave request was ${result.status.toLowerCase()}.${rejectionReason ? ` Note: ${rejectionReason}` : ''}`, category: 'APPROVALS', action: '/hr/self-service', idempotencyKey: `leave:${result.id}:${result.status}` });
      return NextResponse.json({ success: true, data: result });
    }

    if (action === 'CANCEL_APPLICATION') {
      if (!body.applicationId) return NextResponse.json({ error: 'applicationId is required' }, { status: 400 });
      const application = await prisma.leaveApplication.findFirst({ where: { id: body.applicationId, staff: { ...HrAuthorizationService.staffScope(authContext, { userId: authContext.userId }), isActive: true } } });
      if (!application) return NextResponse.json({ error: 'Leave application not found or inaccessible' }, { status: 404 });
      if (!['PENDING_HOD', 'PENDING_HR'].includes(application.status)) return NextResponse.json({ error: 'Only pending leave applications can be withdrawn' }, { status: 422 });
      const updated = await prisma.leaveApplication.update({ where: { id: application.id }, data: { status: 'CANCELLED', rejectionReason: 'Withdrawn by employee' } });
      const allocation = await prisma.leaveAllocation.findUnique({ where: { staffId_leaveTypeId_year: { staffId: application.staffId, leaveTypeId: application.leaveTypeId, year: new Date(application.startDate).getUTCFullYear() } } });
      if (allocation && allocation.pendingDays > 0) await prisma.leaveAllocation.update({ where: { id: allocation.id }, data: { pendingDays: { decrement: Math.min(allocation.pendingDays, application.totalDays) } } });
      return NextResponse.json({ success: true, data: updated });
    }

    if (action === 'CREATE_LEAVE_TYPE') {
      HrAuthorizationService.assertPermission(authContext, 'hr.leave.manage');
      const { name, code, daysPerYear = 20, isPaid = true } = body;

      if (!propertyId) {
        return NextResponse.json({ error: 'Property ID context required to create leave type' }, { status: 400 });
      }

      const leaveType = await prisma.leaveType.create({
        data: {
          propertyId,
          name: name.trim(),
          code: code ? code.trim().toUpperCase() : name.slice(0, 3).toUpperCase(),
          defaultDays: parseInt(daysPerYear, 10) || 20,
          isPaid: Boolean(isPaid),
          isActive: true,
        },
      });
      return NextResponse.json({ success: true, data: leaveType }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid leave action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    if (error.message?.includes('Insufficient leave balance') || error.message?.includes('Cannot re-process')) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error.message?.includes('not found')) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error('Failed to process leave request:', error);
    return NextResponse.json({ error: error.message || 'Failed to process leave request' }, { status: 500 });
  }
}
