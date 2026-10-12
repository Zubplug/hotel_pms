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

    const [departments, positions, allStaff] = await Promise.all([
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
        headOfDept: null,
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
      const { name, code, description } = body;
      if (!name) return NextResponse.json({ error: 'Department name is required' }, { status: 400 });

      const dept = await prisma.department.create({
        data: {
          name: name.trim(),
          code: code ? code.trim().toUpperCase() : name.slice(0, 3).toUpperCase(),
          description: description?.trim() || null,
          propertyId,
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
