import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    if (!HrAuthorizationService.can(authContext, 'hr.employee.view') && !HrAuthorizationService.can(authContext, 'hr.attendance.manage')) {
      return NextResponse.json({ error: 'Forbidden: Insufficient attendance permissions' }, { status: 403 });
    }

    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;

    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date');
    const staffId = searchParams.get('staffId');

    const where: any = {
      staff: {
        ...(organizationId ? { organizationId } : {}),
        ...(propertyId ? { propertyAccess: { has: propertyId } } : {}),
        ...(authContext.role === 'DEPARTMENT_HEAD' && authContext.department
          ? { department: authContext.department }
          : {}),
      },
    };

    if (staffId) {
      where.staffId = staffId;
    }

    if (dateStr) {
      const targetDate = new Date(dateStr);
      const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
      where.date = {
        gte: startOfDay,
        lte: endOfDay,
      };
    }

    const records = await prisma.attendanceRecord.findMany({
      where,
      include: {
        staff: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            department: true,
            position: true,
            shiftRosters: {
              where: dateStr
                ? {
                    date: {
                      gte: new Date(new Date(dateStr).setHours(0, 0, 0, 0)),
                      lte: new Date(new Date(dateStr).setHours(23, 59, 59, 999)),
                    },
                  }
                : undefined,
              include: {
                shift: true,
              },
              take: 1,
            },
          },
        },
      },
      orderBy: { date: 'desc' },
      take: 100,
    });

    const formattedRecords = records.map((r) => {
      let totalHours = 0;
      if (r.clockIn && r.clockOut) {
        let diffMs = new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime();
        // Handle overnight punches where clockOut was recorded next calendar day but same shift
        if (diffMs < 0) {
          diffMs += 24 * 3600 * 1000;
        }
        totalHours = Math.round((diffMs / 3600000) * 10) / 10;
      } else if (r.clockIn) {
        // Shift is actively in-progress; elapsed hours or 0 if not completed
        const elapsedMs = Math.max(0, Date.now() - new Date(r.clockIn).getTime());
        totalHours = Math.round((elapsedMs / 3600000) * 10) / 10;
      }

      const assignedRoster = r.staff.shiftRosters?.[0];
      const shiftName = assignedRoster?.shift?.name || 'Unassigned Roster';
      const shiftTimes = assignedRoster?.shift
        ? `${assignedRoster.shift.startTime} - ${assignedRoster.shift.endTime}`
        : 'Flexible / Unscheduled';

      return {
        id: r.id,
        staffId: r.staffId,
        staffName: `${r.staff.firstName || ''} ${r.staff.lastName || ''}`.trim(),
        department: r.staff.department || 'General',
        position: r.staff.position || 'Staff',
        date: r.date,
        clockIn: r.clockIn,
        clockOut: r.clockOut,
        shiftName,
        shiftTimes,
        totalHours,
        overtimeHours: Math.round((r.overtimeMinutes / 60) * 10) / 10,
        status: r.status,
        punchSource: r.punchSource,
        notes: r.notes,
      };
    });

    return NextResponse.json({ records: formattedRecords });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to get attendance records:', error);
    return NextResponse.json({ error: 'Failed to retrieve attendance' }, { status: 500 });
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

    if (action === 'MANUAL_PUNCH') {
      const { staffId, date, clockIn, clockOut, status = 'PRESENT', notes, overtimeHours = 0 } = body;
      if (!staffId || !date) {
        return NextResponse.json({ error: 'Staff ID and date are required' }, { status: 400 });
      }

      // Verify staff belongs to organization
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
            { error: `Forbidden: Department Head can only record attendance for staff in department [${authContext.department}]` },
            { status: 403 }
          );
        }
      }

      const punchDate = new Date(date);
      const startOfDay = new Date(punchDate.setHours(0, 0, 0, 0));
      const otMins = Math.round(Number(overtimeHours || 0) * 60);
      const targetPropertyId = propertyId || staff.propertyAccess[0];

      if (!targetPropertyId) {
        return NextResponse.json({ error: 'Missing target property context' }, { status: 400 });
      }

      const record = await prisma.attendanceRecord.upsert({
        where: {
          staffId_date: {
            staffId,
            date: startOfDay,
          },
        },
        update: {
          clockIn: clockIn ? new Date(clockIn) : undefined,
          clockOut: clockOut ? new Date(clockOut) : undefined,
          status,
          overtimeMinutes: otMins,
          punchSource: 'MANUAL',
          notes: notes?.trim() || `Manual punch entry recorded by HR (${authContext.userId})`,
        },
        create: {
          propertyId: targetPropertyId,
          staffId,
          date: startOfDay,
          clockIn: clockIn ? new Date(clockIn) : new Date(),
          clockOut: clockOut ? new Date(clockOut) : null,
          status,
          overtimeMinutes: otMins,
          punchSource: 'MANUAL',
          notes: notes?.trim() || `Manual punch entry recorded by HR (${authContext.userId})`,
        },
      });

      return NextResponse.json({ success: true, data: record }, { status: 201 });
    }

    return NextResponse.json({ error: 'Invalid attendance action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) {
      return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    }
    console.error('Failed to process attendance entry:', error);
    return NextResponse.json({ error: 'Failed to process attendance entry' }, { status: 500 });
  }
}
