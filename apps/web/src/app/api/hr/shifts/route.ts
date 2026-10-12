import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    if (!HrAuthorizationService.can(authContext, 'hr.employee.view') && !HrAuthorizationService.can(authContext, 'hr.attendance.manage')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient shift roster permissions' }, { status: 403 });
    }

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    const { searchParams } = new URL(req.url);
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const propertyWhere: any = {};
    if (organizationId) propertyWhere.organizationId = organizationId;
    if (propertyId) propertyWhere.id = propertyId;

    // 1. Fetch shift definitions scoped to tenant
    const shiftTemplates = await prisma.workShift.findMany({
      where: {
        property: propertyWhere,
        isActive: true,
      },
      orderBy: { startTime: 'asc' },
    });

    // 2. Fetch rosters
    const rosterWhere: any = {
      staff: {
        ...(organizationId ? { organizationId } : {}),
        ...(propertyId ? { propertyAccess: { has: propertyId } } : {}),
        ...(authContext.role === 'DEPARTMENT_HEAD' && authContext.department
          ? { department: authContext.department }
          : {}),
      },
    };

    if (startDateStr && endDateStr) {
      rosterWhere.date = {
        gte: new Date(startDateStr),
        lte: new Date(endDateStr),
      };
    }

    const rosters = await prisma.shiftRoster.findMany({
      where: rosterWhere,
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
        shift: true,
      },
      orderBy: { date: 'asc' },
    });

    return NextResponse.json({
      shiftTemplates: shiftTemplates.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.code,
        startTime: s.startTime,
        endTime: s.endTime,
        crossesMidnight: s.isOvernight,
        unpaidBreakMins: s.breakDurationMinutes,
      })),
      rosters: rosters.map((r) => ({
        id: r.id,
        staffId: r.staffId,
        staffName: `${r.staff.firstName || ''} ${r.staff.lastName || ''}`.trim(),
        department: r.staff.department || 'General',
        position: r.staff.position || 'Staff',
        date: r.date,
        shiftId: r.shiftId,
        shiftName: r.shift.name,
        shiftCode: r.shift.code,
        startTime: r.shift.startTime,
        endTime: r.shift.endTime,
        crossesMidnight: r.shift.isOvernight,
        status: r.status,
      })),
    });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get shift rosters:', error);
    return NextResponse.json({ error: 'Failed to retrieve shifts' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.attendance.manage');

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;
    const body = await req.json();
    const { action } = body;

    if (action === 'CREATE_TEMPLATE') {
      const { name, code, startTime, endTime, crossesMidnight = false, unpaidBreakMins = 30 } = body;

      const targetPropertyId = propertyId;
      if (!targetPropertyId) {
        return NextResponse.json({ error: 'Target property ID required' }, { status: 400 });
      }

      const template = await prisma.workShift.create({
        data: {
          propertyId: targetPropertyId,
          name: name.trim(),
          code: code ? code.trim().toUpperCase() : name.slice(0, 3).toUpperCase(),
          startTime,
          endTime,
          isOvernight: Boolean(crossesMidnight),
          breakDurationMinutes: parseInt(unpaidBreakMins, 10) || 30,
          isActive: true,
        },
      });
      return NextResponse.json({ success: true, data: template }, { status: 201 });
    }

    if (action === 'ASSIGN_ROSTER') {
      const { staffId, shiftId, date } = body;
      if (!staffId || !shiftId || !date) {
        return NextResponse.json({ error: 'Staff, shift, and date are required' }, { status: 400 });
      }

      // Verify staff belongs to tenant
      const staff = await prisma.staff.findFirst({
        where: HrAuthorizationService.staffScope(authContext, { id: staffId }),
      });
      if (!staff) {
        return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
      }

      // Department Head boundary check
      if (authContext.role === 'DEPARTMENT_HEAD' && authContext.department) {
        if (staff.department !== authContext.department) {
          return NextResponse.json(
            { error: `Forbidden: Department Head can only assign shifts for staff in department [${authContext.department}]` },
            { status: 403 }
          );
        }
      }

      // Verify shift belongs to tenant
      const shift = await prisma.workShift.findFirst({
        where: {
          id: shiftId,
          property: { organizationId, ...(propertyId ? { id: propertyId } : {}) },
        },
      });
      if (!shift) {
        return NextResponse.json({ error: 'Shift definition not found or inaccessible' }, { status: 404 });
      }

      const rosterDate = new Date(date);
      const startOfDay = new Date(rosterDate.setHours(0, 0, 0, 0));
      const targetPropertyId = propertyId || staff.propertyAccess[0] || shift.propertyId;

      const roster = await prisma.shiftRoster.upsert({
        where: {
          staffId_date: {
            staffId,
            date: startOfDay,
          },
        },
        update: {
          shiftId,
          status: 'SCHEDULED',
        },
        create: {
          propertyId: targetPropertyId,
          staffId,
          shiftId,
          date: startOfDay,
          status: 'SCHEDULED',
        },
      });

      return NextResponse.json({ success: true, data: roster }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid shift action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to update shift roster:', error);
    return NextResponse.json({ error: 'Failed to process shift roster' }, { status: 500 });
  }
}
