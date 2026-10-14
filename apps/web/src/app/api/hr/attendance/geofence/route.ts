import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

function responseError(error: any) {
  const message = String(error?.message || 'Attendance location request failed');
  return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : message.includes('Forbidden') ? 403 : 500 });
}

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.employee.view');
    const geofence = await prisma.attendanceGeofence.findFirst({ where: { propertyId: context.propertyId, organizationId: context.organizationId } });
    return NextResponse.json({ geofence });
  } catch (error) { return responseError(error); }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    HrAuthorizationService.assertPermission(context, 'hr.settings.manage');
    const body = await req.json();
    const latitude = Number(body.latitude);
    const longitude = Number(body.longitude);
    const radiusMeters = Number(body.radiusMeters ?? 150);
    const minAccuracyMeters = Number(body.minAccuracyMeters ?? 100);
    const isEnabled = body.isEnabled !== false;
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90 || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) return NextResponse.json({ error: 'Valid latitude and longitude are required' }, { status: 400 });
    if (!Number.isInteger(radiusMeters) || radiusMeters < 25 || radiusMeters > 2000) return NextResponse.json({ error: 'Allowed radius must be between 25 and 2,000 metres' }, { status: 400 });
    if (!Number.isInteger(minAccuracyMeters) || minAccuracyMeters < 10 || minAccuracyMeters > 500) return NextResponse.json({ error: 'GPS accuracy threshold must be between 10 and 500 metres' }, { status: 400 });
    const property = await prisma.property.findFirst({ where: { id: context.propertyId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
    if (!property) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    const previous = await prisma.attendanceGeofence.findUnique({ where: { propertyId: property.id } });
    const geofence = await prisma.$transaction(async (tx) => {
      const saved = await tx.attendanceGeofence.upsert({ where: { propertyId: property.id }, update: { latitude, longitude, radiusMeters, minAccuracyMeters, isEnabled, updatedBy: context.userId }, create: { organizationId: context.organizationId, propertyId: property.id, latitude, longitude, radiusMeters, minAccuracyMeters, isEnabled, createdBy: context.userId, updatedBy: context.userId } });
      await tx.auditLog.create({ data: { organizationId: context.organizationId, propertyId: property.id, userId: context.userId, action: 'HR_ATTENDANCE_GEOFENCE_UPDATED', resource: 'AttendanceGeofence', resourceId: saved.id, previousValue: previous ? { latitude: Number(previous.latitude), longitude: Number(previous.longitude), radiusMeters: previous.radiusMeters, minAccuracyMeters: previous.minAccuracyMeters, isEnabled: previous.isEnabled } : undefined, newValue: { latitude, longitude, radiusMeters, minAccuracyMeters, isEnabled }, requestId: randomUUID() } });
      return saved;
    });
    return NextResponse.json({ success: true, geofence });
  } catch (error) { return responseError(error); }
}
