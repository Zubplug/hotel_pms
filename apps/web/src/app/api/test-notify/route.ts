import { NextRequest, NextResponse } from 'next/server';
import { NotificationEngine } from '@/lib/notification-engine';
import prisma from '@hotel-pms/db';

export async function GET(req: NextRequest) {
  try {
    const orgId = '79228592-e289-4d6e-b925-662e44513707';
    const propId = '6695b1a4-1186-4f36-a42e-5203ea863c13';

    await NotificationEngine.emit({
      type: 'SYSTEM_INCIDENT',
      organizationId: orgId,
      propertyId: propId,
      entityType: 'system',
      entityId: 'test-123',
      metadata: {
        incidentTitle: 'Debug Notification',
        incidentDescription: 'This is a test to see if notifications save.'
      },
      idempotencyKey: `debug_${Date.now()}`
    });

    const count = await prisma.notification.count({
      where: { organizationId: orgId }
    });

    return NextResponse.json({ success: true, count });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
