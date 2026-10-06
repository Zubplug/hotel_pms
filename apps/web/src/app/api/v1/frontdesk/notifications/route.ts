import { NextRequest, NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';
import { auth } from '@/lib/auth';
import { requireOrganizationContext } from '@/lib/organization-access';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any).id;
    const ctx = await requireOrganizationContext(userId);
    const propertyId = new URL(req.url).searchParams.get('propertyId');
    if (!propertyId || !ctx.propertyIds.includes(propertyId)) {
      return NextResponse.json({ error: 'No access to this property' }, { status: 403 });
    }

    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: userId,
        organizationId: ctx.organizationId,
        propertyId,
        channel: 'in_app',
        readAt: null,
        category: 'Operations',
        metadata: { path: ['notificationType'], equals: 'POS_ROOM_CHARGE_POSTED' },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
    });

    return NextResponse.json({ data: notifications });
  } catch (error) {
    console.error('[Frontdesk notifications GET]', error);
    return NextResponse.json({ error: 'Unable to load notifications' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = (session.user as any).id;
    const ctx = await requireOrganizationContext(userId);
    const { notificationId } = await req.json();
    if (!notificationId) return NextResponse.json({ error: 'Notification ID is required' }, { status: 400 });

    await prisma.notification.updateMany({
      where: { id: notificationId, recipientId: userId, organizationId: ctx.organizationId },
      data: { readAt: new Date() },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Frontdesk notifications PATCH]', error);
    return NextResponse.json({ error: 'Unable to update notification' }, { status: 500 });
  }
}
