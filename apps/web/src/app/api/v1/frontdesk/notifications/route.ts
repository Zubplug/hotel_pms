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

    const frontDeskNotificationTypes = [
      'POS_ROOM_CHARGE_POSTED',
      'RESERVATION_CREATED',
      'RESERVATION_CANCELLED',
      'RESERVATION_EXPIRED',
      'RESERVATION_NO_SHOW',
      'CHECK_IN',
      'CHECK_OUT',
      'PAYMENT_RECEIVED',
      'SHIFT_APPROVED',
      'SHIFT_RETURNED',
      'SHIFT_APPROVED_WITH_VARIANCE',
    ];
    const notifications = await prisma.notification.findMany({
      where: {
        recipientId: userId,
        organizationId: ctx.organizationId,
        propertyId,
        channel: 'in_app',
        readAt: null,
        category: { in: ['Operations', 'Finance'] },
        OR: frontDeskNotificationTypes.map((notificationType) => ({
          metadata: { path: ['notificationType'], equals: notificationType },
        })),
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

    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, recipientId: userId, organizationId: ctx.organizationId },
      select: { id: true, propertyId: true, groupKey: true, metadata: true },
    });
    if (!notification) return NextResponse.json({ error: 'Notification not found' }, { status: 404 });

    const metadata = notification.metadata && typeof notification.metadata === 'object' && !Array.isArray(notification.metadata)
      ? notification.metadata as Record<string, unknown>
      : {};
    const eventKey = notification.groupKey
      || (typeof metadata.idempotencyKey === 'string' ? metadata.idempotencyKey : null)
      || (typeof metadata.incidentKey === 'string' ? metadata.incidentKey : null);

    // A retry can have produced multiple rows before the original was read.
    // Acknowledge the whole event group so an older duplicate cannot ring next.
    const where: any = {
      recipientId: userId,
      organizationId: ctx.organizationId,
      propertyId: notification.propertyId,
    };
    if (eventKey) {
      where.OR = [
        { groupKey: eventKey },
        { metadata: { path: ['idempotencyKey'], equals: eventKey } },
        { metadata: { path: ['incidentKey'], equals: eventKey } },
      ];
    } else {
      where.id = notification.id;
    }

    const result = await prisma.notification.updateMany({ where, data: { readAt: new Date() } });
    return NextResponse.json({ success: true, acknowledgedCount: result.count });
  } catch (error) {
    console.error('[Frontdesk notifications PATCH]', error);
    return NextResponse.json({ error: 'Unable to update notification' }, { status: 500 });
  }
}
