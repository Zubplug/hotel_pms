import { NextResponse } from 'next/server';
import prisma from '@hotel-pms/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { propertyId, userId, overridePosConflicts, overrideReason, deviceId } = body;

    const property = await prisma.property.findUnique({
      where: { id: propertyId }
    });

    if (!property || !property.businessDate) {
      return NextResponse.json({ error: 'Property or business date not found' }, { status: 404 });
    }

    const businessDate = new Date(property.businessDate);

    // 1. POS Conflict Validation
    const openSessions = await prisma.posSession.count({
      where: {
        propertyId,
        businessDate: businessDate,
        status: { in: ['OPEN', 'RECONCILIATION_REQUIRED'] }
      }
    });

    const conflicts = await prisma.syncConflict.count({
      where: {
        propertyId,
        status: 'PENDING'
      }
    });

    if ((openSessions > 0 || conflicts > 0) && !overridePosConflicts) {
      return NextResponse.json({
        error: 'POS_CONFLICTS_EXIST',
        message: 'Cannot run night audit. There are open POS sessions or pending conflicts.',
        openSessions,
        conflicts
      }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // If overridden, audit it
      if (overridePosConflicts) {
        await tx.posAuthorizationAudit.create({
          data: {
            id: crypto.randomUUID(),
            propertyId,
            deviceId: deviceId || 'SERVER',
            requestedBy: userId,
            authorizedBy: userId, // Assuming the requester is authorized
            action: 'NIGHT_AUDIT_OVERRIDE',
            reason: overrideReason || 'Forced EOD via override',
            operationId: `eod_override_${propertyId}_${Date.now()}`,
            businessDate: businessDate
          }
        });
      }

      // 2. Perform Night Audit
      const nextDate = new Date(businessDate);
      nextDate.setDate(nextDate.getDate() + 1);

      await tx.nightAudit.create({
        data: {
          propertyId,
          businessDate: businessDate,
          status: 'COMPLETED',
          runBy: userId,
          startedAt: new Date(),
          completedAt: new Date(),
          posUnresolvedVariances: openSessions,
          posSessionsPending: openSessions,
        }
      });

      // 3. Rollover business date
      await tx.property.update({
        where: { id: propertyId },
        data: {
          businessDate: nextDate,
          lastAuditAt: new Date(),
        }
      });
    });

    return NextResponse.json({ success: true, message: 'Night audit completed successfully' }, { status: 200 });

  } catch (error: any) {
    console.error('Night Audit Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
