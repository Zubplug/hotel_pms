import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';
import { notifyEmployee } from '@/lib/employee-notification-service';

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

    const workPatterns = await prisma.staffShiftPattern.findMany({
      where: {
        propertyId: propertyId || undefined,
        staff: HrAuthorizationService.staffScope(authContext),
      },
      orderBy: { updatedAt: 'desc' },
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
        departmentId: s.departmentId,
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
        publicationStatus: r.publicationStatus,
        publishedAt: r.publishedAt,
      })),
      workPatterns: workPatterns.map((pattern) => ({
        id: pattern.id,
        staffId: pattern.staffId,
        shiftId: pattern.shiftId,
        onDays: pattern.onDays,
        offDays: pattern.offDays,
        anchorDate: pattern.anchorDate,
        isActive: pattern.isActive,
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

    if (action === 'SAVE_PATTERN') {
      const { staffId, shiftId, onDays, offDays, anchorDate, startDate, endDate } = body;
      const on = Number.parseInt(String(onDays), 10);
      const off = Number.parseInt(String(offDays), 10);
      const anchor = new Date(`${anchorDate}T00:00:00.000Z`);
      if (!staffId || !shiftId || !anchorDate || !Number.isInteger(on) || !Number.isInteger(off) || on < 1 || off < 1 || Number.isNaN(anchor.getTime())) {
        return NextResponse.json({ error: 'Staff, shift, valid on/off days, and anchor date are required' }, { status: 400 });
      }

      const staff = await prisma.staff.findFirst({ where: HrAuthorizationService.staffScope(authContext, { id: staffId, isActive: true, deletedAt: null }) });
      if (!staff) return NextResponse.json({ error: 'Staff member not found or inaccessible' }, { status: 404 });
      const shift = await prisma.workShift.findFirst({ where: { id: shiftId, propertyId, isActive: true } });
      if (!shift) return NextResponse.json({ error: 'Shift template not found for this property' }, { status: 404 });

      const saved = await prisma.$transaction(async (tx) => {
        const pattern = await tx.staffShiftPattern.upsert({
          where: { staffId },
          update: { propertyId, shiftId, onDays: on, offDays: off, anchorDate: anchor, isActive: true },
          create: { propertyId, staffId, shiftId, onDays: on, offDays: off, anchorDate: anchor, isActive: true },
        });

        let generated = 0;
        if (startDate && endDate) {
          const start = new Date(`${startDate}T00:00:00.000Z`);
          const end = new Date(`${endDate}T00:00:00.000Z`);
          if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) throw new Error('A valid generation date range is required');
          const existing = await tx.shiftRoster.findMany({ where: { staffId, date: { gte: start, lte: end } }, select: { id: true, date: true, status: true, publicationStatus: true } });
          const existingByDate = new Map(existing.map((roster) => [roster.date.toISOString().slice(0, 10), roster]));
          const cycle = on + off;
          for (let cursor = new Date(start); cursor <= end; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
            const date = new Date(cursor);
            const offset = Math.floor((date.getTime() - anchor.getTime()) / 86400000);
            const isWorkingDay = ((offset % cycle) + cycle) % cycle < on;
            if (!isWorkingDay) continue;
            const dateKey = date.toISOString().slice(0, 10);
            const current = existingByDate.get(dateKey);
            // A peer-approved/HR-acknowledged swap is a dated exception to the
            // employee's baseline work pattern and must not be overwritten by
            // a later pattern generation.
            if (current?.publicationStatus === 'PUBLISHED' || current?.status === 'SWAPPED') continue;
            await tx.shiftRoster.upsert({
              where: { staffId_date: { staffId, date } },
              update: { propertyId, departmentId: shift.departmentId, shiftId, status: 'SCHEDULED', publicationStatus: 'DRAFT', publishedAt: null, publishedById: null, cancelledAt: null, cancelledById: null },
              create: { propertyId, departmentId: shift.departmentId, staffId, shiftId, date, status: 'SCHEDULED' },
            });
            generated += 1;
          }
        }
        return { pattern, generated };
      });
      return NextResponse.json({ success: true, data: saved.pattern, generated: saved.generated }, { status: 201 });
    }

    if (action === 'CREATE_TEMPLATE') {
      const { name, code, startTime, endTime, crossesMidnight = false, unpaidBreakMins = 30, departmentId } = body;

      const targetPropertyId = propertyId;
      if (!targetPropertyId) {
        return NextResponse.json({ error: 'Target property ID required' }, { status: 400 });
      }

      if (!String(name || '').trim() || !String(startTime || '').match(/^([01]\d|2[0-3]):[0-5]\d$/) || !String(endTime || '').match(/^([01]\d|2[0-3]):[0-5]\d$/)) {
        return NextResponse.json({ error: 'Shift name, start time, and end time are required in valid format' }, { status: 400 });
      }
      if (departmentId) {
        const department = await prisma.department.findFirst({ where: { id: departmentId, propertyId: targetPropertyId, isActive: true } });
        if (!department) return NextResponse.json({ error: 'Department not found for this property' }, { status: 400 });
      }

      const template = await prisma.workShift.create({
        data: {
          propertyId: targetPropertyId,
          departmentId: departmentId || null,
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

      const shiftDepartment = shift.departmentId
        ? await prisma.department.findFirst({ where: { id: shift.departmentId, propertyId: shift.propertyId }, select: { name: true } })
        : null;
      if (shiftDepartment && staff.department !== shiftDepartment.name) {
        return NextResponse.json({ error: 'This shift is restricted to its department' }, { status: 400 });
      }

      const rosterDate = new Date(date);
      const startOfDay = new Date(rosterDate.setHours(0, 0, 0, 0));
      const targetPropertyId = propertyId || staff.propertyAccess[0] || shift.propertyId;
      const existingRoster = await prisma.shiftRoster.findUnique({ where: { staffId_date: { staffId, date: startOfDay } }, select: { id: true, publicationStatus: true } });
      if (existingRoster?.publicationStatus === 'PUBLISHED') return NextResponse.json({ error: 'Published rosters must be cancelled before they can be changed' }, { status: 409 });

      const roster = await prisma.shiftRoster.upsert({
        where: {
          staffId_date: {
            staffId,
            date: startOfDay,
          },
        },
        update: {
          shiftId,
          propertyId: shift.propertyId,
          departmentId: shift.departmentId,
          status: 'SCHEDULED',
          publicationStatus: 'DRAFT',
          publishedAt: null,
          publishedById: null,
          cancelledAt: null,
          cancelledById: null,
        },
        create: {
          propertyId: targetPropertyId,
          departmentId: shift.departmentId,
          staffId,
          shiftId,
          date: startOfDay,
          status: 'SCHEDULED',
        },
      });

      await notifyEmployee({
        organizationId,
        propertyId: targetPropertyId,
        staffId,
        subject: 'Shift roster updated',
        body: `You have been scheduled for ${shift.name} on ${rosterDate.toISOString().slice(0, 10)} (${shift.startTime}–${shift.endTime}). The roster is awaiting publication.`,
        category: 'OPERATIONS',
        action: '/hr/self-service',
        idempotencyKey: `shift-roster:${roster.id}:${roster.updatedAt.toISOString()}`,
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

export async function PATCH(req: NextRequest) {
  try {
    const authContext = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(authContext, 'hr.attendance.manage');
    const body = await req.json();
    const propertyId = authContext.propertyId;
    if (!propertyId) return NextResponse.json({ error: 'Property context is required' }, { status: 400 });

    if (body.action === 'UPDATE_TEMPLATE') {
      const { id, name, code, startTime, endTime, crossesMidnight = false, unpaidBreakMins = 30 } = body;
      if (!id) return NextResponse.json({ error: 'Shift template ID is required' }, { status: 400 });
      if (!String(name || '').trim() || !String(startTime || '').match(/^([01]\d|2[0-3]):[0-5]\d$/) || !String(endTime || '').match(/^([01]\d|2[0-3]):[0-5]\d$/)) {
        return NextResponse.json({ error: 'Shift name, start time, and end time are required in valid format' }, { status: 400 });
      }

      const template = await prisma.workShift.findFirst({ where: { id, propertyId } });
      if (!template) return NextResponse.json({ error: 'Shift template not found for this property' }, { status: 404 });

      const updated = await prisma.workShift.update({
        where: { id: template.id },
        data: {
          name: name.trim(),
          code: code ? code.trim().toUpperCase() : name.trim().slice(0, 3).toUpperCase(),
          startTime,
          endTime,
          isOvernight: Boolean(crossesMidnight),
          breakDurationMinutes: parseInt(unpaidBreakMins, 10) || 30,
        },
      });
      return NextResponse.json({ success: true, data: updated });
    }

    if (body.action === 'PUBLISH_ROSTER') {
      const startDate = new Date(`${body.startDate}T00:00:00.000Z`);
      const endDate = new Date(`${body.endDate}T00:00:00.000Z`);
      if (!body.startDate || !body.endDate || Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime()) || startDate > endDate) return NextResponse.json({ error: 'A valid roster date range is required' }, { status: 400 });
      const pending = await prisma.shiftRoster.findMany({ where: { propertyId, date: { gte: startDate, lte: endDate }, publicationStatus: { not: 'CANCELLED' }, status: { not: 'CANCELLED' } }, include: { shift: true } });
      await prisma.shiftRoster.updateMany({ where: { id: { in: pending.map((roster) => roster.id) } }, data: { publicationStatus: 'PUBLISHED', publishedAt: new Date(), publishedById: authContext.userId } });
      await Promise.all(pending.map((roster) => notifyEmployee({ organizationId: authContext.organizationId, propertyId, staffId: roster.staffId, subject: 'Shift roster published', body: `Your ${roster.shift.name} shift on ${roster.date.toISOString().slice(0, 10)} is now published.`, category: 'OPERATIONS', action: '/hr/self-service', idempotencyKey: `shift-published:${roster.id}:${startDate.toISOString()}` })));
      return NextResponse.json({ success: true, published: pending.length });
    }

    if (body.action === 'CANCEL_ROSTER') {
      if (!body.id) return NextResponse.json({ error: 'Roster ID is required' }, { status: 400 });
      const roster = await prisma.shiftRoster.findFirst({ where: { id: body.id, propertyId, publicationStatus: { not: 'CANCELLED' }, staff: HrAuthorizationService.staffScope(authContext) }, include: { shift: true } });
      if (!roster) return NextResponse.json({ error: 'Roster not found or already cancelled' }, { status: 404 });
      const updated = await prisma.shiftRoster.update({ where: { id: roster.id }, data: { status: 'CANCELLED', publicationStatus: 'CANCELLED', cancelledAt: new Date(), cancelledById: authContext.userId } });
      await notifyEmployee({ organizationId: authContext.organizationId, propertyId, staffId: roster.staffId, subject: 'Shift roster cancelled', body: `Your ${roster.shift.name} shift on ${roster.date.toISOString().slice(0, 10)} has been cancelled.`, category: 'OPERATIONS', action: '/hr/self-service', idempotencyKey: `shift-cancelled:${roster.id}:${updated.updatedAt.toISOString()}` });
      return NextResponse.json({ success: true, data: updated });
    }

    return NextResponse.json({ error: 'Invalid shift action' }, { status: 400 });
  } catch (error: any) {
    if (error.message?.includes('Forbidden') || error.message?.includes('Unauthorized')) return NextResponse.json({ error: error.message }, { status: error.message.includes('Forbidden') ? 403 : 401 });
    console.error('Failed to control shift roster:', error);
    return NextResponse.json({ error: 'Failed to control shift roster' }, { status: 500 });
  }
}
