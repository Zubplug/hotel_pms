import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { HrAuthorizationService } from '@/lib/services/hr-authorization-service';

export async function GET(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const staff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Linked employee record not found' }, { status: 404 });
    const notifications = await prisma.notification.findMany({ where: { organizationId: context.organizationId, recipientType: 'staff', recipientId: staff.id }, orderBy: { createdAt: 'desc' }, take: 100 });
    return NextResponse.json({ notifications, unreadCount: notifications.filter((notification) => !notification.readAt).length });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to load notifications' }, { status: error.message?.includes('Unauthorized') ? 401 : 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const context = await HrAuthorizationService.resolveAuthContext(req);
    const staff = await prisma.staff.findFirst({ where: { userId: context.userId, organizationId: context.organizationId, isActive: true }, select: { id: true } });
    if (!staff) return NextResponse.json({ error: 'Linked employee record not found' }, { status: 404 });
    const body = await req.json();
    const where = { organizationId: context.organizationId, recipientType: 'staff', recipientId: staff.id, ...(body.notificationId ? { id: String(body.notificationId) } : {}) };
    const result = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    return NextResponse.json({ success: true, updated: result.count });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Unable to update notification' }, { status: error.message?.includes('Unauthorized') ? 401 : 500 });
  }
}
