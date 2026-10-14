import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

function dayStart(value: string | Date) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function scheduledBoundary(date: Date, time: string, overnight = false) {
  const [hours, minutes] = String(time || '00:00').split(':').map(Number);
  const boundary = new Date(date);
  boundary.setUTCHours(hours || 0, minutes || 0, 0, 0);
  if (overnight) boundary.setUTCDate(boundary.getUTCDate() + 1);
  return boundary;
}

function calculateAttendance(date: Date, clockIn: Date | null, clockOut: Date | null, roster: any) {
  if (!roster) return { lateMinutes: 0, earlyDepartureMinutes: 0, overtimeMinutes: 0, status: clockIn ? 'PRESENT' : 'ABSENT' };
  const start = scheduledBoundary(date, roster.shift.startTime, false);
  const end = scheduledBoundary(date, roster.shift.endTime, roster.shift.isOvernight);
  const lateMinutes = clockIn ? Math.max(0, Math.floor((clockIn.getTime() - start.getTime()) / 60000) - roster.shift.gracePeriodMinutes) : 0;
  const earlyDepartureMinutes = clockOut ? Math.max(0, Math.floor((end.getTime() - clockOut.getTime()) / 60000)) : 0;
  const overtimeMinutes = clockOut ? Math.max(0, Math.floor((clockOut.getTime() - end.getTime()) / 60000)) : 0;
  return { lateMinutes, earlyDepartureMinutes, overtimeMinutes, status: !clockIn ? 'ABSENT' : lateMinutes > 0 ? 'LATE' : 'PRESENT' };
}

function distanceInMeters(latitudeA: number, longitudeA: number, latitudeB: number, longitudeB: number) {
  const earthRadius = 6371000;
  const toRadians = (value: number) => (value * Math.PI) / 180;
  const dLatitude = toRadians(latitudeB - latitudeA);
  const dLongitude = toRadians(longitudeB - longitudeA);
  const a = Math.sin(dLatitude / 2) ** 2 + Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) * Math.sin(dLongitude / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    const organizationId = authContext.organizationId;
    const propertyId = authContext.propertyId;
    const canManageAttendance = HrAuthorizationService.can(authContext, 'hr.employee.view') || HrAuthorizationService.can(authContext, 'hr.attendance.manage');

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

    // Ordinary employees may read only their own attendance records.
    if (!canManageAttendance) where.staff.userId = authContext.userId;

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
        punches: { orderBy: { punchedAt: 'asc' } },
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
        locationStatus: r.locationStatus,
        punches: r.punches.map((p) => ({ id: p.id, action: p.action, punchedAt: p.punchedAt, latitude: p.latitude, longitude: p.longitude, accuracyMeters: p.accuracyMeters, distanceMeters: p.distanceMeters, locationStatus: p.locationStatus, punchSource: p.punchSource, recordedBy: p.recordedBy })),
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

    if (action === 'CLOCK_IN' || action === 'CLOCK_OUT') {
      const staffId = body.staffId || (await prisma.staff.findFirst({ where: { userId: authContext.userId, organizationId, isActive: true, deletedAt: null }, select: { id: true } }))?.id;
      if (!staffId) return NextResponse.json({ error: 'Active employee record not found' }, { status: 404 });
      const staff = await prisma.staff.findFirst({ where: { ...HrAuthorizationService.staffScope(authContext, { id: staffId }), isActive: true, deletedAt: null }, select: { id: true, userId: true, propertyAccess: true } });
      if (!staff || (staff.userId !== authContext.userId && !HrAuthorizationService.can(authContext, 'hr.attendance.manage'))) return NextResponse.json({ error: 'You may only record your own attendance' }, { status: 403 });
      const date = dayStart(body.date || new Date());
      const targetPropertyId = propertyId || staff.propertyAccess[0];
      if (!targetPropertyId) return NextResponse.json({ error: 'No property context is available for attendance' }, { status: 400 });
      const roster = await prisma.shiftRoster.findFirst({ where: { staffId, propertyId: targetPropertyId, date, publicationStatus: 'PUBLISHED', status: { not: 'CANCELLED' } }, include: { shift: true } });
      if (!roster) return NextResponse.json({ error: 'No published shift roster exists for this date' }, { status: 409 });
      const now = body.timestamp ? new Date(body.timestamp) : new Date();
      if (Number.isNaN(now.getTime())) return NextResponse.json({ error: 'Invalid attendance timestamp' }, { status: 400 });
      const punchSource = body.punchSource === 'MOBILE' ? 'MOBILE' : 'WEB';
      const geofence = await prisma.attendanceGeofence.findFirst({ where: { propertyId: targetPropertyId, organizationId } });
      if (!geofence) return NextResponse.json({ error: 'Attendance location has not been configured for this property. Contact HR.' }, { status: 409 });
      if (!geofence.isEnabled) return NextResponse.json({ error: 'Location-restricted attendance is currently disabled for this property. Contact HR.' }, { status: 409 });
      const latitude = Number(body.latitude);
      const longitude = Number(body.longitude);
      const accuracyMeters = Number(body.accuracyMeters);
      if (![latitude, longitude, accuracyMeters].every(Number.isFinite) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || accuracyMeters < 0) return NextResponse.json({ error: 'A valid current GPS location and accuracy are required to record attendance' }, { status: 422 });
      if (accuracyMeters > geofence.minAccuracyMeters) return NextResponse.json({ error: `GPS accuracy is too low (${Math.round(accuracyMeters)}m). Move to an open area and try again.` }, { status: 422 });
      const distanceMeters = distanceInMeters(latitude, longitude, Number(geofence.latitude), Number(geofence.longitude));
      if (distanceMeters > geofence.radiusMeters) return NextResponse.json({ error: `You are approximately ${Math.round(distanceMeters)}m from the attendance location. You must be within ${geofence.radiusMeters}m.` }, { status: 403 });
      const existing = await prisma.attendanceRecord.findUnique({ where: { staffId_date: { staffId, date } } });
      if (action === 'CLOCK_IN' && existing?.clockIn) return NextResponse.json({ error: 'You are already clocked in for this date' }, { status: 409 });
      if (action === 'CLOCK_OUT' && (!existing || !existing.clockIn)) return NextResponse.json({ error: 'Clock in must be recorded before clock out' }, { status: 409 });
      const clockIn = action === 'CLOCK_IN' ? now : existing?.clockIn || null;
      const clockOut = action === 'CLOCK_OUT' ? now : existing?.clockOut || null;
      const calculated = calculateAttendance(date, clockIn ? new Date(clockIn) : null, clockOut ? new Date(clockOut) : null, roster);
      const record = await prisma.$transaction(async (tx) => {
        const saved = await tx.attendanceRecord.upsert({ where: { staffId_date: { staffId, date } }, update: { clockIn: clockIn || undefined, clockOut: clockOut || undefined, ...calculated, punchSource, locationStatus: 'VERIFIED' }, create: { propertyId: targetPropertyId, staffId, date, clockIn: clockIn || now, clockOut, ...calculated, punchSource, locationStatus: 'VERIFIED' } });
        await tx.attendancePunch.create({ data: { attendanceRecordId: saved.id, action, punchedAt: now, latitude, longitude, accuracyMeters, distanceMeters, locationStatus: 'VERIFIED', punchSource, recordedBy: authContext.userId } });
        return saved;
      });
      return NextResponse.json({ success: true, data: record }, { status: 201 });
    }

    if (action === 'MARK_ABSENT') {
      HrAuthorizationService.assertPermission(authContext, 'hr.attendance.manage');
      const date = dayStart(body.date || new Date());
      if (date.getTime() > dayStart(new Date()).getTime()) return NextResponse.json({ error: 'Future dates cannot be marked absent' }, { status: 400 });
      const rosters = await prisma.shiftRoster.findMany({ where: { propertyId, date, publicationStatus: 'PUBLISHED', status: { not: 'CANCELLED' }, staff: HrAuthorizationService.staffScope(authContext) }, include: { shift: true } });
      let marked = 0;
      for (const roster of rosters) {
        const existing = await prisma.attendanceRecord.findUnique({ where: { staffId_date: { staffId: roster.staffId, date } } });
        if (!existing) { await prisma.attendanceRecord.create({ data: { propertyId: roster.propertyId, staffId: roster.staffId, date, status: 'ABSENT', punchSource: 'MANUAL', notes: 'Automatically marked absent: no punch recorded' } }); marked++; }
      }
      return NextResponse.json({ success: true, marked });
    }

    if (action === 'MANUAL_PUNCH') {
      const { staffId, date, clockIn, clockOut, status = 'PRESENT', notes, overtimeHours = 0 } = body;
      if (!staffId || !date) {
        return NextResponse.json({ error: 'Staff ID and date are required' }, { status: 400 });
      }
      if (!notes?.trim() || notes.trim().length < 10) return NextResponse.json({ error: 'A detailed reason is required for a manual attendance exception' }, { status: 400 });

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

      const roster = await prisma.shiftRoster.findFirst({ where: { staffId, propertyId: targetPropertyId, date: startOfDay, publicationStatus: 'PUBLISHED', status: { not: 'CANCELLED' } }, include: { shift: true } });
      const calculated = calculateAttendance(startOfDay, clockIn ? new Date(clockIn) : null, clockOut ? new Date(clockOut) : null, roster);
      const record = await prisma.$transaction(async (tx) => {
        const saved = await tx.attendanceRecord.upsert({
          where: { staffId_date: { staffId, date: startOfDay } },
          update: { clockIn: clockIn ? new Date(clockIn) : undefined, clockOut: clockOut ? new Date(clockOut) : undefined, status: status === 'PRESENT' ? calculated.status : status, lateMinutes: calculated.lateMinutes, earlyDepartureMinutes: calculated.earlyDepartureMinutes, overtimeMinutes: otMins || calculated.overtimeMinutes, punchSource: 'MANUAL', locationStatus: 'MANUAL_OVERRIDE', notes: notes.trim() },
          create: { propertyId: targetPropertyId, staffId, date: startOfDay, clockIn: clockIn ? new Date(clockIn) : new Date(), clockOut: clockOut ? new Date(clockOut) : null, status: status === 'PRESENT' ? calculated.status : status, lateMinutes: calculated.lateMinutes, earlyDepartureMinutes: calculated.earlyDepartureMinutes, overtimeMinutes: otMins || calculated.overtimeMinutes, punchSource: 'MANUAL', locationStatus: 'MANUAL_OVERRIDE', notes: notes.trim() },
        });
        await tx.attendancePunch.create({ data: { attendanceRecordId: saved.id, action: 'MANUAL_OVERRIDE', punchedAt: new Date(), locationStatus: 'MANUAL_OVERRIDE', punchSource: 'MANUAL', recordedBy: authContext.userId } });
        await tx.auditLog.create({ data: { organizationId, propertyId: targetPropertyId, userId: authContext.userId, action: 'HR_ATTENDANCE_MANUAL_OVERRIDE', resource: 'AttendanceRecord', resourceId: saved.id, newValue: { staffId, date, clockIn, clockOut, reason: notes.trim() }, requestId: randomUUID() } });
        return saved;
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
