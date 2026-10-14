import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.view');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    const propWhere: any = { organizationId };
    if (propertyId) propWhere.id = propertyId;

    const [departments, positions, allStaff, headCandidates, positionChangeRequests] = await Promise.all([
      prisma.department.findMany({
        where: {
          property: propWhere,
        },
        include: {
          sections: {
            where: { isActive: true },
          },
          property: {
            select: { id: true, name: true },
          },
          headStaff: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.jobPosition.findMany({
        where: {
          property: propWhere,
        },
        include: {
          department: {
            select: { id: true, name: true },
          },
        },
        orderBy: { title: 'asc' },
      }),
      prisma.staff.findMany({
        where: {
          organizationId,
          ...(propertyId ? { propertyAccess: { has: propertyId } } : {}),
          ...(authContext.role === 'DEPARTMENT_HEAD' && authContext.department
            ? { department: authContext.department }
            : {}),
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          department: true,
          position: true,
        },
      }),
      prisma.staff.findMany({
        where: {
          organizationId,
          ...(propertyId ? { propertyAccess: { has: propertyId } } : {}),
          ...(authContext.role === 'DEPARTMENT_HEAD' && authContext.department
            ? { department: authContext.department }
            : {}),
          isActive: true,
          deletedAt: null,
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          department: true,
          position: true,
        },
        orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
      }),
      prisma.positionChangeRequest.findMany({
        where: { propertyId, status: 'PENDING' },
        include: {
          position: { select: { id: true, title: true, code: true, minSalary: true, maxSalary: true, headcountBudget: true } },
          requestedBy: { select: { id: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const formattedDepartments = departments.map((d) => {
      const headcount = allStaff.filter((s) => s.department === d.name).length;
      return {
        id: d.id,
        name: d.name,
        code: d.code,
        description: d.description,
        propertyName: d.property?.name,
        propertyId: d.propertyId,
        headOfDept: d.headStaff
          ? `${d.headStaff.firstName} ${d.headStaff.lastName}`.trim() || d.headStaff.email
          : null,
        headStaffId: d.headStaffId,
        sectionsCount: d.sections.length,
        sections: d.sections,
        headcount,
      };
    });

    const formattedPositions = positions.map((p) => {
      const activeHeadcount = allStaff.filter((s) => s.position === p.title).length;
      return {
        id: p.id,
        title: p.title,
        code: p.code,
        gradeLevel: 'Standard',
        minSalary: Number(p.minSalary || 0),
        maxSalary: Number(p.maxSalary || 0),
        headcountBudget: p.headcountBudget || 1,
        activeHeadcount,
        department: p.department?.name || 'General',
        departmentId: p.departmentId,
        isActive: p.isActive,
      };
    });

    return NextResponse.json({
      departments: formattedDepartments,
      positions: formattedPositions,
      headCandidates,
      canApprovePositionChanges: ['GENERAL_MANAGER', 'SUPER_ADMIN', 'OWNER', 'ADMIN', 'CEO'].includes(authContext.role),
      positionChangeRequests: positionChangeRequests.map((request) => ({
        ...request,
        proposedMinSalary: request.proposedMinSalary == null ? null : Number(request.proposedMinSalary),
        proposedMaxSalary: request.proposedMaxSalary == null ? null : Number(request.proposedMaxSalary),
        requestedByName: request.requestedBy.email,
      })),
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get org structure:', error);
    return NextResponse.json({ error: 'Failed to retrieve organization structure' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.manage');

    const propertyId = authContext.propertyId;
    if (!propertyId) {
      return NextResponse.json({ error: 'Property ID required' }, { status: 400 });
    }

    const body = await req.json();
    const { type } = body; // 'DEPARTMENT' | 'SECTION' | 'POSITION'

    if (type === 'DEPARTMENT') {
      const { name, code, description, headStaffId } = body;
      if (!name) return NextResponse.json({ error: 'Department name is required' }, { status: 400 });

      if (headStaffId) {
        const head = await prisma.staff.findFirst({
          where: {
            id: headStaffId,
            organizationId: authContext.organizationId,
            propertyAccess: { has: propertyId },
            isActive: true,
            deletedAt: null,
          },
        });
        if (!head) return NextResponse.json({ error: 'Department head not found in current property' }, { status: 404 });
      }

      const dept = await prisma.department.create({
        data: {
          name: name.trim(),
          code: code ? code.trim().toUpperCase() : name.slice(0, 3).toUpperCase(),
          description: description?.trim() || null,
          propertyId,
          headStaffId: headStaffId || null,
          isActive: true,
        },
      });
      return NextResponse.json({ success: true, data: dept }, { status: 201 });
    }

    if (type === 'SECTION') {
      const { departmentId, name, code, description } = body;
      if (!departmentId || !name) {
        return NextResponse.json({ error: 'Department and section name are required' }, { status: 400 });
      }

      // Verify department belongs to this property
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, propertyId },
      });
      if (!dept) {
        return NextResponse.json({ error: 'Department not found in current property' }, { status: 404 });
      }

      const section = await prisma.departmentSection.create({
        data: {
          departmentId,
          name: name.trim(),
          code: code ? code.trim().toUpperCase() : name.slice(0, 3).toUpperCase(),
          description: description?.trim() || null,
          isActive: true,
        },
      });
      return NextResponse.json({ success: true, data: section }, { status: 201 });
    }

    if (type === 'POSITION') {
      const { title, code, departmentId, minSalary, maxSalary, headcountBudget, description } = body;
      if (!title || !departmentId) {
        return NextResponse.json({ error: 'Position title and department are required' }, { status: 400 });
      }

      // Verify department belongs to this property
      const dept = await prisma.department.findFirst({
        where: { id: departmentId, propertyId },
      });
      if (!dept) {
        return NextResponse.json({ error: 'Department not found in current property' }, { status: 404 });
      }

      const position = await prisma.jobPosition.create({
        data: {
          propertyId,
          departmentId,
          title: title.trim(),
          code: code ? code.trim().toUpperCase() : title.slice(0, 4).toUpperCase(),
          minSalary: minSalary ? Number(minSalary) : 0,
          maxSalary: maxSalary ? Number(maxSalary) : 0,
          headcountBudget: headcountBudget ? parseInt(headcountBudget, 10) : 1,
          description: description?.trim() || null,
          isActive: true,
        },
      });
      return NextResponse.json({ success: true, data: position }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid entity type specified' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to create org unit:', error);
    return NextResponse.json({ error: 'Failed to create organization unit' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.employee.manage');

    const propertyId = authContext.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property ID required' }, { status: 400 });

    const body = await req.json();
    const { departmentId, name, code, description, headStaffId, positionId, changeRequestId, action, minSalary, maxSalary, headcountBudget, reason, reviewNotes } = body;

    if (action === 'APPROVE' || action === 'REJECT') {
      if (!['GENERAL_MANAGER', 'SUPER_ADMIN', 'OWNER', 'ADMIN', 'CEO'].includes(authContext.role)) {
        return NextResponse.json({ error: 'Only the General Manager can approve position changes' }, { status: 403 });
      }

      const change = await prisma.positionChangeRequest.findFirst({ where: { id: changeRequestId, propertyId, status: 'PENDING' } });
      if (!change) return NextResponse.json({ error: 'Pending position change not found' }, { status: 404 });
      if (change.requestedById === authContext.userId) return NextResponse.json({ error: 'The requester cannot approve their own position change' }, { status: 403 });

      if (action === 'REJECT') {
        const rejected = await prisma.positionChangeRequest.update({
          where: { id: change.id },
          data: { status: 'REJECTED', reviewNotes: reviewNotes?.trim() || null, reviewedById: authContext.userId, reviewedAt: new Date() },
        });
        return NextResponse.json({ success: true, data: rejected });
      }

      const approved = await prisma.$transaction(async (tx) => {
        const updatedPosition = await tx.jobPosition.update({
          where: { id: change.positionId },
          data: {
            minSalary: change.proposedMinSalary,
            maxSalary: change.proposedMaxSalary,
            headcountBudget: change.proposedHeadcount,
          },
        });
        const updatedRequest = await tx.positionChangeRequest.update({
          where: { id: change.id },
          data: { status: 'APPROVED', reviewNotes: reviewNotes?.trim() || null, reviewedById: authContext.userId, reviewedAt: new Date() },
        });
        return { position: updatedPosition, request: updatedRequest };
      });
      return NextResponse.json({ success: true, data: approved });
    }

    if (positionId) {
      const position = await prisma.jobPosition.findFirst({ where: { id: positionId, propertyId } });
      if (!position) return NextResponse.json({ error: 'Position not found in current property' }, { status: 404 });

      const proposedMinSalary = minSalary === '' || minSalary == null ? null : Number(minSalary);
      const proposedMaxSalary = maxSalary === '' || maxSalary == null ? null : Number(maxSalary);
      const proposedHeadcount = Number(headcountBudget);
      if ((proposedMinSalary != null && (!Number.isFinite(proposedMinSalary) || proposedMinSalary < 0)) ||
        (proposedMaxSalary != null && (!Number.isFinite(proposedMaxSalary) || proposedMaxSalary < 0)) ||
        (proposedMinSalary != null && proposedMaxSalary != null && proposedMinSalary > proposedMaxSalary) ||
        !Number.isInteger(proposedHeadcount) || proposedHeadcount < 1) {
        return NextResponse.json({ error: 'Enter a valid salary band and a whole-number headcount of at least 1' }, { status: 400 });
      }

      const pending = await prisma.positionChangeRequest.findFirst({ where: { positionId, status: 'PENDING' } });
      if (pending) return NextResponse.json({ error: 'This position already has a pending change awaiting General Manager approval' }, { status: 409 });

      const request = await prisma.positionChangeRequest.create({
        data: {
          positionId,
          propertyId,
          requestedById: authContext.userId,
          proposedMinSalary,
          proposedMaxSalary,
          proposedHeadcount,
          reason: reason?.trim() || null,
        },
      });
      return NextResponse.json({ success: true, pendingApproval: true, data: request }, { status: 201 });
    }

    if (!departmentId) return NextResponse.json({ error: 'Department ID is required' }, { status: 400 });

    const department = await prisma.department.findFirst({ where: { id: departmentId, propertyId } });
    if (!department) return NextResponse.json({ error: 'Department not found in current property' }, { status: 404 });

    if (headStaffId) {
      const head = await prisma.staff.findFirst({
        where: {
          id: headStaffId,
          organizationId: authContext.organizationId,
          propertyAccess: { has: propertyId },
          isActive: true,
          deletedAt: null,
        },
      });
      if (!head) return NextResponse.json({ error: 'Department head not found in current property' }, { status: 404 });
    }

    const updated = await prisma.department.update({
      where: { id: departmentId },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(code !== undefined ? { code: code ? String(code).trim().toUpperCase() : null } : {}),
        ...(description !== undefined ? { description: description ? String(description).trim() : null } : {}),
        headStaffId: headStaffId || null,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to update department:', error);
    return NextResponse.json({ error: 'Failed to update department' }, { status: 500 });
  }
}
