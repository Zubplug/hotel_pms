import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const staff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    const requests = await prisma.compensationChangeRequest.findMany({ where: { organizationId: context.organizationId, propertyId: context.propertyId, staffId: staff.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json({ requests });
  } catch (error: any) {
    const message = String(error?.message || 'Unable to load compensation changes');
    return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const staff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Employee record not found' }, { status: 404 });
    const body = await req.json();
    if (!body.id || body.action !== 'ACKNOWLEDGE') return NextResponse.json({ error: 'A compensation request and acknowledge action are required' }, { status: 400 });
    const request = await prisma.compensationChangeRequest.updateMany({ where: { id: body.id, staffId: staff.id, organizationId: context.organizationId, propertyId: context.propertyId, status: { in: ['APPROVED', 'SCHEDULED', 'APPLIED'] } }, data: { employeeAcknowledgedAt: new Date() } });
    if (!request.count) return NextResponse.json({ error: 'Compensation change not found or not ready for acknowledgement' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    const message = String(error?.message || 'Unable to acknowledge compensation change');
    return NextResponse.json({ error: message }, { status: message.includes('Unauthorized') ? 401 : 500 });
  }
}
